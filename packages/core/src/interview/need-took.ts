import { DriverName, type Lang } from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import type { Line } from "./card.js";
import { NeedSlot, type NeedState } from "./need.js";
import { driverChoice } from "./need-drivers.js";
import { NOT_HEARD } from "./need-say.js";
import type { NeedDraft } from "./need-types.js";
import { DAY_NAME } from "./need-understood.js";

/**
 * What a typed or spoken answer gave the need, read back in small print over the next question: "Understood: 2
 * bedrooms, with dishes, by the hour." The first answer's note names the work (`need-understood.ts`); this one names
 * what each later answer filled, so the owner sees their words were read and not just kept. Built only from the
 * draft the word lists filled, never a model's words. A tap says itself, and the owner's own words kept as they are
 * (the job's details) are on screen already, so neither gets a line.
 */

/** The parts of an answer, in the order the line names them. */
function tookParts(lang: Lang, before: NeedDraft, after: NeedDraft, areaName: string | undefined): string[] {
  const drivers = Object.entries(after.drivers ?? {}).filter(([name, v]) => before.drivers?.[name as DriverName] !== v);
  const day = after.day !== before.day && after.day !== undefined ? DAY_NAME[after.day] : undefined;
  const keys: { key: MessageKey; params?: Record<string, string | number> }[] = [
    ...drivers.flatMap(([name, value]) => {
      const driver = DriverName.safeParse(name);
      return driver.success && value !== undefined ? [driverChoice(lang, driver.data, value)] : [];
    }),
    ...(after.arrangement && after.arrangement !== before.arrangement
      ? [{ key: `arrangement.${after.arrangement}` as const }]
      : []),
    ...(day ? [{ key: day }] : []),
  ];
  const words = keys.map((k) => t(lang, k.key, k.params));
  const time = after.time !== before.time && after.time ? [after.time] : [];
  const area = after.area !== before.area && areaName ? [areaName] : [];
  return [...words, ...time, ...area];
}

/** The parts as one list, as a sentence runs: the first starts upper-case, the rest lower ("By the hour, tomorrow"). */
const listed = (lang: Lang, parts: readonly string[]): string =>
  parts
    .map((p, i) => (i === 0 ? p.charAt(0).toLocaleUpperCase(lang) : p.charAt(0).toLocaleLowerCase(lang)) + p.slice(1))
    .join(", ");

/** The area as the owner knows it: the saved address's locality, else the pilot area's name. */
const areaNameOf = (s: NeedState, d: NeedDraft): string | undefined =>
  d.areaName ?? s.config.areas.find((a) => a.key === d.area)?.names[0];

/**
 * `next` with the line for what `prev`'s answer gave it; none when the answer was not understood (the question comes
 * again), named the work (that note says it), or filled nothing the line names.
 */
export function withTook(prev: NeedState, next: NeedState): NeedState {
  const retried = next.notes.some((n) => NOT_HEARD.includes(n.key));
  if (retried || next.understood || prev.slot === NeedSlot.trade) return { ...next, took: undefined };
  const parts = tookParts(prev.config.own, prev.draft, next.draft, areaNameOf(next, next.draft));
  if (parts.length === 0) return { ...next, took: undefined };
  const took: Line = { key: "need.understood", params: { what: listed(prev.config.own, parts) }, silent: true };
  return { ...next, took };
}
