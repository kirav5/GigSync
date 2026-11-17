import { type Estimate, EstimateBasisKind, type EstimateRequest, type Lang } from "@gigsync/protocol";
import { type MessageKey, pluralKey, t } from "../i18n/t.js";
import type { Line } from "./card.js";
import { isMessageKey } from "./choices.js";

/**
 * What an ADR 0041 estimate says about itself, under its range: what it rests on ("34 GigSync jobs + Bengaluru rate
 * card: Karnataka minimum wages 2026 + GigSync seed, unverified"), how sure it is, what its spread mostly depends on,
 * and which drivers were assumed because the owner did not know them.
 */

const K = EstimateBasisKind.enum;
const JOIN = " + ";

/** One source of the blend in the reader's words. */
function partText(own: Lang, kind: EstimateBasisKind, estimate: Estimate, city: string): string {
  switch (kind) {
    case K.gigsync: {
      const jobs = estimate.basis.gigsync_jobs;
      return t(own, pluralKey(own, "driver.basis.gigsync", jobs), { count: jobs });
    }
    case K.rate_card: {
      const sources = (estimate.basis.rate_card?.sources ?? []).map((s) => s.name).join(JOIN);
      return t(own, "driver.basis.rate_card", { city, sources });
    }
  }
}

/** "From 34 GigSync jobs + Bengaluru rate card: Karnataka minimum wages 2026." */
export function blendLine(own: Lang, request: Pick<EstimateRequest, "city">, estimate: Estimate): Line {
  const cityKey = `city.${request.city}`;
  const city = isMessageKey(cityKey) ? t(own, cityKey) : request.city;
  const parts = (estimate.basis.blend ?? []).map((kind) => partText(own, kind, estimate, city));
  return { key: "driver.basis_line", params: { parts: parts.join(JOIN) } };
}

const noun = (name: string): MessageKey => `driver.noun.${name}` as MessageKey;

/** How sure the range is, what drives its spread, and what was assumed. */
export function driverLines(estimate: Estimate): Line[] {
  const lines: Line[] = [];
  if (estimate.confidence)
    lines.push({ key: "driver.confidence_line", names: { level: [`driver.confidence.${estimate.confidence}`] } });
  if (estimate.spread_by) lines.push({ key: "driver.spread", names: { driver: [noun(estimate.spread_by)] } });
  const assumed = estimate.assumed ?? [];
  if (assumed.length > 0) lines.push({ key: "driver.assumed", names: { drivers: assumed.map(noun) } });
  return lines;
}

/** A need outside the trades: plainly, no prices yet and no listed worker, and how to go on. */
export const jobTypeLines = (jobType: string): Line[] => [{ key: "driver.no_trade", params: { job: jobType } }];
