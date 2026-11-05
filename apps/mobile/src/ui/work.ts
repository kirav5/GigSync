import { cardRatesOf, hourText } from "@gigsync/core";
import { type BoardProfile, ISO_WEEKDAYS, type JobRequest, TimeWindow, type WorkHours } from "@gigsync/protocol";
import type { I18n } from "../i18n.js";
import { money, unitKey } from "./places.js";

/**
 * The work, as a person reads it (ADR 0047): trades in the reader's language, a worker's own skills in their own
 * words, as they wrote them; and when they work.
 */

const LIST = ", ";
/** Between a card's days and its hours. */
const PARTS = " · ";

/** What a card lists: its trades, then its skills, joined. */
export const cardWork = (t: I18n["t"], card: Pick<BoardProfile, "trades" | "skills">): string =>
  [...card.trades.map((tr) => t(`trade.${tr}`)), ...(card.skills ?? []).map((s) => s.text)].join(LIST);

/** A card's rates as a person reads them (ADR 0053 §7), each in its unit: "₹200 a visit", "₹9,000 a month". */
export const cardRates = (t: I18n["t"], card: Parameters<typeof cardRatesOf>[0]): string[] =>
  cardRatesOf(card).map(({ arrangement, rate_paise }) =>
    arrangement
      ? t("price.per", { price: money(rate_paise), unit: t(unitKey(arrangement)) })
      : t("find.from", { price: money(rate_paise) }),
  );

/** A card's rates on one line, for a list of workers. */
export const cardRateLine = (t: I18n["t"], card: Parameters<typeof cardRates>[1]): string =>
  cardRates(t, card).join(PARTS);

/** What a request is for: the listed skill asked for, else the trade's name. */
export const requestWork = (t: I18n["t"], request: Pick<JobRequest, "trade" | "skill">): string =>
  request.skill?.text ?? t(`trade.${request.trade}`);

/**
 * When a card says the worker works (ADR 0050 §2, ADR 0053 §1): "Mon, Tue · 9 am – 6 pm", their hours on the clock when
 * they set them, else the parts of the day; every day or every part of the day goes unsaid. Undefined when they work
 * any time.
 */
export function cardHours({ lang, t }: Pick<I18n, "lang" | "t">, hours: WorkHours | undefined): string | undefined {
  if (!hours) return undefined;
  const days =
    hours.days.length < ISO_WEEKDAYS.length
      ? ISO_WEEKDAYS.filter((d) => hours.days.includes(d))
          .map((d) => t(`day.${d}`))
          .join(LIST)
      : "";
  const clock =
    hours.from !== undefined && hours.to !== undefined
      ? t("terms.hours_span", { from: hourText(lang, hours.from), to: hourText(lang, hours.to) })
      : hours.windows.length < TimeWindow.options.length
        ? hours.windows.map((w) => t(`terms.window.${w}`)).join(LIST)
        : "";
  return [days, clock].filter(Boolean).join(PARTS) || undefined;
}
