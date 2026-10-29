import { EVERY_DAY, type Lang, TermKey, type Terms, type TermWhen } from "@gigsync/protocol";
import { type Fact, FactKind } from "../job/explain.js";
import { priceText } from "./reasons.js";
import { LOCALE, plural, t } from "./t.js";

/**
 * Terms and offer explanations as the owner reads them, in their language (ADR 0033 §3–4). The day is written by the
 * phone's own locale; every other value is a string key, so nothing is translated by machine.
 */

const K = TermKey.enum;
/** Separates the terms of one proposal in a sentence. */
const LIST = ", ";
/** Separates the sentences of an explanation. */
const SENTENCE = " ";
/** ISO days are calendar days: format them in UTC so no time zone moves them. */
const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };

/** "2 Nov, morning", or "Every day, morning" for work done every day. */
export function whenText(lang: Lang, when: TermWhen): string {
  const day =
    when.day === EVERY_DAY ? t(lang, "when.daily") : new Date(when.day).toLocaleDateString(LOCALE[lang], DAY_FORMAT);
  return t(lang, "terms.when", { day, window: t(lang, `terms.window.${when.window}`) });
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
      if (fact.typical_paise === undefined || fact.sources === undefined) return t(lang, "explain.usual_range", range);
      return plural(lang, "explain.usual", fact.sources, { ...range, typical: priceText(fact.typical_paise) });
    }
    case FactKind.limit: {
      const params = { limit: priceText(fact.limit_paise), gap: priceText(fact.gap_paise) };
      return t(lang, fact.within ? "explain.limit_within" : "explain.limit_outside", params);
    }
  }
}

/** The template explanation: one sentence per fact. */
export const factsText = (lang: Lang, facts: readonly Fact[], name: string): string =>
  facts.map((f) => factText(lang, f, name)).join(SENTENCE);
