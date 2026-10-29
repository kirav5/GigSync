import type { EstimateRequest, QuoteCovers, RateUnit } from "@gigsync/protocol";
import type { QuoteSource } from "../src/estimates/source.js";
import type { FetchedPage, SourcedQuotes } from "../src/estimates/verify.js";

export const COOK: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };
export const MAID: EstimateRequest = { city: "bengaluru", trade: "maid", scope: { rooms: "bhk2", frequency: "daily" } };
export const PAINTER: EstimateRequest = {
  city: "bengaluru",
  trade: "painter",
  scope: { rooms: "bhk2", labour_only: "yes" },
};
export const ELECTRICIAN: EstimateRequest = { city: "bengaluru", trade: "electrician", scope: { problem: "fan" } };

export interface FakeQuote {
  url: string;
  sentence: string;
  amount_rupees: number;
  unit: RateUnit;
  covers: QuoteCovers;
  site: string;
}

/** A sentence that writes the amount, long enough to count. */
export const sentenceFor = (rupees: number, unit: string) =>
  `In Bengaluru the usual price is ₹${rupees.toLocaleString("en-IN")} per ${unit} for this work.`;

/**
 * Pages and quotes for the given amounts, one page per amount, spread round-robin over the given sites, each quote
 * written on its page. `unit` and `covers` apply to every quote.
 */
export function quotesAt(
  amounts: readonly number[],
  sites: readonly string[],
  unit: RateUnit = "month",
  covers: QuoteCovers = {},
): SourcedQuotes {
  const pages: FetchedPage[] = [];
  const quotes: FakeQuote[] = [];
  amounts.forEach((rupees, i) => {
    const site = sites[i % sites.length] ?? "a.example";
    const url = `https://${site}/page-${i}`;
    const sentence = sentenceFor(rupees, unit);
    pages.push({ url, text: `Header text. ${sentence} Footer text.` });
    quotes.push({ url, sentence, amount_rupees: rupees, unit, covers, site });
  });
  return { pages, quotes };
}

/** A quote source that hands back what `make` gives and counts its calls. */
export class FakeSource implements QuoteSource {
  readonly name = "fake";
  calls = 0;

  constructor(
    private readonly make: () => Promise<SourcedQuotes> | SourcedQuotes,
    readonly cached = true,
  ) {}

  async quotes(): Promise<SourcedQuotes> {
    this.calls += 1;
    return this.make();
  }
}
