import {
  ESTIMATE_MAX_PAISE,
  ExtractedQuote,
  MAX_SOURCE_SENTENCE,
  PAISE_PER_RUPEE,
  type QuoteCovers,
  type RateUnit,
} from "@gigsync/protocol";
import { MIN_SENTENCE_CHARS } from "./constants.js";
import { normaliseText, pageKey, siteOf, writesAmount } from "./text.js";

/** A page as the web fetch returned it: the text every quote is checked against. */
export interface FetchedPage {
  url: string;
  text: string;
}

/** What a quote source hands back: the fetched pages and the model's quotes, unchecked (`unknown` until parsed). */
export interface SourcedQuotes {
  pages: FetchedPage[];
  quotes: unknown[];
}

/** Why a quote was left out. Logged as counts and asserted in tests; never shown to a user. */
export const DropReason = {
  malformed: "malformed",
  noPage: "no_page",
  sentenceTooShort: "sentence_too_short",
  sentenceTooLong: "sentence_too_long",
  sentenceNotOnPage: "sentence_not_on_page",
  amountNotInSentence: "amount_not_in_sentence",
  duplicate: "duplicate",
  unitMismatch: "unit_mismatch",
  scopeMismatch: "scope_mismatch",
  outlier: "outlier",
} as const;
export type DropReason = (typeof DropReason)[keyof typeof DropReason];

/** A quote whose sentence is on its fetched page and whose number is in that sentence. */
export interface CheckedQuote {
  /** The fetched page's own URL, not the model's spelling of it. */
  url: string;
  site: string;
  sentence: string;
  amount_rupees: number;
  unit: RateUnit;
  covers: QuoteCovers;
}

interface Checked<T> {
  kept: T[];
  dropped: DropReason[];
}

interface Page {
  url: string;
  text: string;
}

/** Fetched pages by page key, text normalised once; a page fetched twice keeps both texts. */
function pagesByKey(pages: readonly FetchedPage[]): Map<string, Page> {
  const byKey = new Map<string, Page>();
  for (const page of pages) {
    const key = pageKey(page.url);
    if (!key) continue;
    const text = normaliseText(page.text);
    const seen = byKey.get(key);
    byKey.set(key, { url: seen?.url ?? page.url, text: seen ? `${seen.text} ${text}` : text });
  }
  return byKey;
}

/** At least one paisa and at most the estimate ceiling. */
const validAmount = (rupees: number) =>
  Number.isFinite(rupees) && rupees * PAISE_PER_RUPEE >= 1 && rupees * PAISE_PER_RUPEE <= ESTIMATE_MAX_PAISE;

/** One quote against the pages: the checked quote, or why it fails. */
function checkOne(raw: unknown, pages: Map<string, Page>): CheckedQuote | DropReason {
  const parsed = ExtractedQuote.safeParse(raw);
  if (!parsed.success || !validAmount(parsed.data.amount_rupees)) return DropReason.malformed;
  const q = parsed.data;
  const key = pageKey(q.url);
  if (!key) return DropReason.malformed;
  const page = pages.get(key);
  if (!page) return DropReason.noPage;
  const sentence = normaliseText(q.sentence);
  if (sentence.length < MIN_SENTENCE_CHARS) return DropReason.sentenceTooShort;
  if (q.sentence.length > MAX_SOURCE_SENTENCE) return DropReason.sentenceTooLong;
  if (!page.text.includes(sentence)) return DropReason.sentenceNotOnPage;
  if (!writesAmount(q.sentence, q.amount_rupees)) return DropReason.amountNotInSentence;
  return {
    url: page.url,
    site: siteOf(page.url),
    sentence: q.sentence.trim(),
    amount_rupees: q.amount_rupees,
    unit: q.unit,
    covers: q.covers,
  };
}

/**
 * Keeps a quote only when its sentence appears (case, spacing and typography normalised) in a page the web fetch
 * returned for the same URL, and its amount is a number that sentence writes. The same amount in the same unit from
 * the same page counts once, so a model repeating itself cannot outvote the other sites.
 */
export function checkQuotes(source: SourcedQuotes): Checked<CheckedQuote> {
  const pages = pagesByKey(source.pages);
  const kept: CheckedQuote[] = [];
  const dropped: DropReason[] = [];
  const seen = new Set<string>();
  for (const raw of source.quotes) {
    const result = checkOne(raw, pages);
    if (typeof result === "string") {
      dropped.push(result);
      continue;
    }
    const identity = `${pageKey(result.url)}|${result.amount_rupees}|${result.unit}`;
    if (seen.has(identity)) {
      dropped.push(DropReason.duplicate);
      continue;
    }
    seen.add(identity);
    kept.push(result);
  }
  return { kept, dropped };
}
