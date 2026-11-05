import { Arrangement, arrangementsOf, type BoardProfile, DEFAULT_ARRANGEMENT } from "@gigsync/protocol";

/** One rate a card shows: in its arrangement's unit, or with no unit when the card names none. */
export interface CardRate {
  arrangement?: Arrangement;
  rate_paise: number;
}

/**
 * A card's rates in the order of the arrangements (ADR 0053 §7). A card of one rate takes its unit from the work: a
 * repair's is a visit, and any other trade's the month every card once meant. Only a card of a worker's own skills with
 * no arrangement has no unit.
 */
export function cardRatesOf(card: Pick<BoardProfile, "trades" | "arrangements" | "rate_paise">): CardRate[] {
  const { arrangements, rate_paise } = card;
  if (arrangements?.length) return Arrangement.options.flatMap((a) => arrangements.filter((r) => r.arrangement === a));
  const [work] = card.trades;
  if (!work) return [{ rate_paise }];
  const [only, ...more] = arrangementsOf(work);
  return [{ arrangement: only && more.length === 0 ? only : DEFAULT_ARRANGEMENT, rate_paise }];
}
