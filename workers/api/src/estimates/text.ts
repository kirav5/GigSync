/**
 * Reading page text the way the checks need it: sentences compared after normalising case, spacing and typography,
 * and every rupee amount a sentence writes ("₹14,000", "Rs. 1.5 lakh", "15k", "1,50,000/-").
 */

const SPACES = /\s+/g;
const SINGLE_QUOTES = /[‘’‚′]/g;
const DOUBLE_QUOTES = /[“”„″]/g;
const DASHES = /[‐-―−]/g;
/** Markdown emphasis a fetched page's text may carry around a price, which a copied sentence leaves out. */
const EMPHASIS = /[*_`]/g;
const UNICODE_FORM = "NFKC";

/** Case, spacing, quotes, dashes and emphasis normalised, so a copied sentence matches the page it came from. */
export function normaliseText(text: string): string {
  return text
    .normalize(UNICODE_FORM)
    .toLowerCase()
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, "-")
    .replace(EMPHASIS, "")
    .replace(SPACES, " ")
    .trim();
}

/** A number as Indian pages write it (Indian or Western comma grouping, optional decimals) and an optional scale word. */
const AMOUNT = /(?<!\d)(\d+(?:,\d+)*(?:\.\d+)?)(?!\d)\s*(?:(lakhs?|lacs?|crores?|thousand|k)\b)?/gi;
const GROUPING = /,/g;
const THOUSAND = 1_000;
const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

/** Scale words by their first letter: k, t(housand), l(akh/ac), c(rore). */
const SCALE: Readonly<Record<string, number>> = { k: THOUSAND, t: THOUSAND, l: LAKH, c: CRORE };

/** Every amount a sentence writes, in rupees. A scale word multiplies its own number only ("14-22k" gives 14, 22000). */
export function amountsIn(sentence: string): number[] {
  const found: number[] = [];
  for (const match of sentence.normalize(UNICODE_FORM).matchAll(AMOUNT)) {
    const value = Number((match[1] ?? "").replace(GROUPING, ""));
    if (!Number.isFinite(value)) continue;
    const word = match[2]?.toLowerCase();
    found.push(word ? value * (SCALE[word.charAt(0)] ?? 1) : value);
  }
  return found;
}

/** Amounts are compared to the paisa: a model writing 12.5 for "₹12.50" matches; 12.4 does not. */
const PAISA = 0.01;

export const writesAmount = (sentence: string, rupees: number): boolean =>
  amountsIn(sentence).some((amount) => Math.abs(amount - rupees) < PAISA / 2);

const WWW = /^www\./;

/** A URL reduced to what identifies a page: host without "www.", path without a trailing slash, query kept. */
export function pageKey(url: string): string | undefined {
  if (!URL.canParse(url)) return undefined;
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.hostname.toLowerCase().replace(WWW, "")}${path}${u.search}`;
}

/** The site a page is on: its host without "www.". Taken from the URL, never from what the model says. */
export const siteOf = (url: string): string => new URL(url).hostname.toLowerCase().replace(WWW, "");
