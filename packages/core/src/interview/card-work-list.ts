import { cardWorks, type WorkId } from "../job/work-rates.js";
import type { CardDraft } from "./card.js";

/**
 * Which kinds of a card still want a rate of their own (ADR 0062). Apart from the questions, so the interview's shape
 * (`card.ts`) can read it without loading them.
 */

/** The card's kinds besides the first. */
export const otherWorks = (d: CardDraft): WorkId[] => cardWorks(d).slice(1);

/** The card has more than one kind, so it may price them apart. */
export const asksWorkRates = (d: CardDraft): boolean => otherWorks(d).length > 0;

/** The next kind without a rate, once the worker said the prices differ. */
export function missingWorkRate(d: CardDraft): WorkId | undefined {
  if (d.same_rate !== false) return undefined;
  return otherWorks(d).find((w) => d.work_rates?.[w] === undefined);
}
