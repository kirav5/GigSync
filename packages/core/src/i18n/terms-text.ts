import { DAY_HOURS, EVERY_DAY, type Lang, TermKey, type Terms, type TermWhen } from "@gigsync/protocol";
import { type Fact, FactKind } from "../job/explain.js";
import { AFTERNOON_FROM, EVENING_FROM } from "../schedule/windows.js";
import { priceText } from "./reasons.js";
import { LOCALE, type MessageKey, plural, t } from "./t.js";

/**
 * Terms and offer explanations as the owner reads them, in their language (ADR 0033 §3–4). The day is written by the
 * phone's own locale; every other value is a string key, so nothing is translated by machine.
 */

const K = TermKey.enum;
/** Separates the terms of one proposal in a sentence. */
const LIST = ", ";
/** Separates the sentences of an explanation. */
const SENTENCE = " ";
const NOON = 12;
/** ISO days are calendar days: format them in UTC so no time zone moves them. */
const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };

/** An hour on the clock in the owner's words, by the part of the day it is in: "2 pm", "दोपहर 2 बजे". */
export function hourText(lang: Lang, hour: number): string {
  // Midnight, as the end of a working day (24) or a start (0), reads as 12 in the morning's words.
  const clock = hour % DAY_HOURS;
  const key: MessageKey =
    clock < AFTERNOON_FROM ? "hour.morning" : clock < EVENING_FROM ? "hour.afternoon" : "hour.evening";
  return t(lang, key, { h: clock % NOON || NOON });
}

/** "2 Nov, 2 pm" with a start hour (ADR 0053 §1), else "2 Nov, morning"; "Every day, …" for work done every day. */
export function whenText(lang: Lang, when: TermWhen): string {
  const day =
    when.day === EVERY_DAY ? t(lang, "when.daily") : new Date(when.day).toLocaleDateString(LOCALE[lang], DAY_FORMAT);
  const time = when.hour !== undefined ? hourText(lang, when.hour) : t(lang, `terms.window.${when.window}`);
  return t(lang, "terms.when", { day, window: time });
}

/** One term's value as a phrase; undefined when the terms do not set it. */
export function termText(lang: Lang, key: TermKey, terms: Terms): string | undefined {
  switch (key) {
    case K.when:
      return terms.when && whenText(lang, terms.when);
    case K.materials:
      return terms.materials && t(lang, `terms.materials.${terms.materials}`);
    case K.coats:
      return terms.coats === undefined ? undefined : plural(lang, "terms.coats", terms.coats);
    case K.hours:
      return terms.hours === undefined ? undefined : plural(lang, "terms.hours", terms.hours);
  }
}

/** Every term the terms set, one phrase each, in the protocol's order. */
export const termsLines = (lang: Lang, terms: Terms | undefined, keys = TermKey.options): string[] =>
  terms ? keys.flatMap((key) => termText(lang, key, terms) ?? []) : [];

/** One fact as a sentence; `name` is the other side as the owner knows them. */
export function factText(lang: Lang, fact: Fact, name: string): string {
  const side = (mine: boolean) => (mine ? "mine" : "theirs");
  switch (fact.kind) {
    case FactKind.opened:
      return t(lang, `explain.opened_${side(fact.mine)}`, { name, price: priceText(fact.price_paise) });
    case FactKind.moved: {
      const way = fact.to_paise < fact.from_paise ? "down" : "up";
      const params = { name, price: priceText(fact.to_paise), delta: priceText(fact.delta_paise) };
      return t(lang, `explain.${way}_${side(fact.mine)}`, params);
    }
    case FactKind.held:
      return t(lang, `explain.held_${side(fact.mine)}`, { name, price: priceText(fact.price_paise) });
    case FactKind.terms: {
      const terms = termsLines(lang, fact.terms, fact.changed).join(LIST);
      return t(lang, `explain.terms_${side(fact.mine)}`, { name, terms });
    }
    case FactKind.usual: {
      const range = { low: priceText(fact.low_paise), high: priceText(fact.high_paise) };
      if (fact.typical_paise === undefined) return t(lang, "explain.usual_range", range);
      const usual = { ...range, typical: priceText(fact.typical_paise) };
      if (fact.jobs !== undefined) return plural(lang, "explain.usual_jobs", fact.jobs, usual);
      return t(lang, "explain.usual_range", range);
    }
    case FactKind.limit: {
      const params = { limit: priceText(fact.limit_paise), gap: priceText(fact.gap_paise) };
      return t(lang, `explain.limit.${fact.owner}.${fact.side}`, params);
    }
  }
}

/** The template explanation: one sentence per fact. */
export const factsText = (lang: Lang, facts: readonly Fact[], name: string): string =>
  facts.map((f) => factText(lang, f, name)).join(SENTENCE);
