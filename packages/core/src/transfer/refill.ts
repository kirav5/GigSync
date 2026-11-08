import { type BoardProfile, Lang, type RateCard } from "@gigsync/protocol";
import { atShare, workOfRate } from "../job/work-rates.js";
import type { WorkerRules } from "../job/worker.js";

/** The public card's fields put back into the account on a phone that lost the worker's rules. */
export interface RefilledCard {
  worker: WorkerRules;
  languages: Lang[];
  about: string;
}

/** What the card does not carry, from the app: how far the worker goes, and the city's going rates. */
export interface RefillDefaults {
  radius_km: number;
  rates?: RateCard;
}

/**
 * The worker's rules again, from their card as the board serves it (ADR 0037 §4), after a reinstall or on a new phone:
 * trades, area, usual rates (each kind's too, ADR 0062), languages and the line about their work. The lowest price never left the old phone, so it
 * starts at the usual rate, which the agent never goes below, and `floor_missing` makes the agent show the worker each
 * request before quoting until they give it (`withFloor`). What they asked to see first and their terms are not on
 * the card either: they start empty.
 */
export function refillFromCard(card: BoardProfile, defaults: RefillDefaults): RefilledCard {
  return {
    worker: {
      trades: card.trades,
      ...(card.skills?.length ? { skills: card.skills } : {}),
      rate: { opening_paise: card.rate_paise, limit_paise: card.rate_paise },
      ...(card.work_rates?.length
        ? {
            work_rates: card.work_rates.map((r) => ({
              work: workOfRate(r),
              rate: { opening_paise: r.rate_paise, limit_paise: r.rate_paise },
            })),
          }
        : {}),
      base: card.area,
      radius_km: defaults.radius_km,
      ...(defaults.rates ? { rates: defaults.rates } : {}),
      ask_me: [],
      floor_missing: true,
    },
    languages: card.languages.flatMap((l) => {
      const known = Lang.safeParse(l);
      return known.success ? [known.data] : [];
    }),
    about: card.about,
  };
}

/** A lowest price the worker typed that the agent cannot use: not a positive amount, or above their usual rate. */
export class FloorError extends Error {}

/** The rules with the worker's own lowest price, so the agent quotes on its own again. Throws FloorError. */
export function withFloor(rules: WorkerRules, limitPaise: number): WorkerRules {
  if (!Number.isInteger(limitPaise) || limitPaise <= 0 || limitPaise > rules.rate.opening_paise)
    throw new FloorError("lowest price must be positive and at most the usual rate");
  const { floor_missing: _missing, ...rest } = rules;
  const rate = { ...rules.rate, limit_paise: limitPaise };
  // Each other kind's lowest follows at the same share of its usual rate (ADR 0062), until the worker sets it.
  const work_rates = rules.work_rates?.map((w) => ({ ...w, rate: atShare(w.rate.opening_paise, rate) }));
  return { ...rest, rate, ...(work_rates ? { work_rates } : {}) };
}
