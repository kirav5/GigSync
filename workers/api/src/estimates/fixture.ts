import { type EstimateRequest, type QuoteCovers, RateUnit, Trade } from "@gigsync/protocol";
import { SourceName } from "./constants.js";
import type { QuoteSource } from "./source.js";
import type { FetchedPage, SourcedQuotes } from "./verify.js";

/**
 * Canned pages and quotes for local runs and browser tests (ESTIMATE_SOURCE=fixture, local only): no web, no key.
 * The real checks and arithmetic run over them, so each trade also carries quotes that must be dropped: a sentence
 * that is not on its page, a number that is not in its sentence, another scope, an outlier. Pages are on `.example`
 * hosts, which never resolve. Expected results (Bengaluru):
 *   painter bhk2 labour only: ₹14,000 / ₹16,000 / ₹18,000 per job, 5 sources from 3 sites
 *   cook 3–4 people, 2 meals: ₹10,000 / ₹11,000 / ₹12,000 a month, 5 sources
 *   maid bhk2 daily: ₹3,500 (raised to the legal floor) / ₹3,500 / ₹4,500 a month, floored
 * Any other trade or scope has too few quotes.
 */

const U = RateUnit.enum;
const T = Trade.enum;

interface Canned {
  pages: FetchedPage[];
  quotes: { url: string; sentence: string; amount_rupees: number; unit: RateUnit; covers: QuoteCovers }[];
}

const PAINT_A = "https://homepaint.example/bengaluru/2bhk-painting-cost";
const PAINT_B = "https://www.paintpros.example/blog/painting-charges";
const PAINT_C = "https://urbanfix.example/painting";
const PAINT_A1 =
  "Labour-only repainting of a 2BHK flat in Bengaluru costs ₹12,000 to ₹16,000 when you buy the paint yourself.";
const PAINT_A2 = "Painting a 2BHK with materials starts at ₹28,000 in Bengaluru.";
const PAINT_B1 = "Our painters charge ₹14,000 for labour on a 2BHK repaint, with the paint supplied by the owner.";
const PAINT_B2 = "Expect about ₹22,000 in labour for a large 2BHK of 1,200 sq ft if you buy the paint.";
const PAINT_B3 = "Labour rates in Bengaluru run at ₹12 per sq ft of wall area.";
const PAINT_C1 = "A 2BHK labour-only repaint here is ₹18,000, and a 3BHK is ₹26,000.";
const LABOUR_2BHK = { rooms: 2, materials_included: false };

const PAINTER: Canned = {
  pages: [
    { url: PAINT_A, text: `# Painting cost in Bengaluru\n\n${PAINT_A1} ${PAINT_A2}` },
    { url: PAINT_B, text: `Painting charges, 2026.\n\n**${PAINT_B1}** ${PAINT_B2}\n${PAINT_B3}` },
    { url: PAINT_C, text: `Book a painter. ${PAINT_C1} Prices include cleanup.` },
  ],
  quotes: [
    { url: PAINT_A, sentence: PAINT_A1, amount_rupees: 12000, unit: U.job, covers: LABOUR_2BHK },
    { url: PAINT_A, sentence: PAINT_A1, amount_rupees: 16000, unit: U.job, covers: LABOUR_2BHK },
    {
      url: PAINT_A,
      sentence: PAINT_A2,
      amount_rupees: 28000,
      unit: U.job,
      covers: { rooms: 2, materials_included: true },
    },
    {
      url: "https://paintpros.example/blog/painting-charges/",
      sentence: PAINT_B1,
      amount_rupees: 14000,
      unit: U.job,
      covers: LABOUR_2BHK,
    },
    {
      url: PAINT_B,
      sentence: PAINT_B2,
      amount_rupees: 22000,
      unit: U.job,
      covers: { ...LABOUR_2BHK, area_sqft: 1200 },
    },
    { url: PAINT_B, sentence: PAINT_B3, amount_rupees: 12, unit: U.sqft, covers: { materials_included: false } },
    { url: PAINT_C, sentence: PAINT_C1, amount_rupees: 18000, unit: U.job, covers: LABOUR_2BHK },
    {
      url: PAINT_C,
      sentence: PAINT_C1,
      amount_rupees: 26000,
      unit: U.job,
      covers: { rooms: 3, materials_included: false },
    },
    // Hostile: a sentence the page does not have, and a number the sentence does not write.
    {
      url: PAINT_C,
      sentence: "A 2BHK labour-only repaint costs ₹15,000 on average.",
      amount_rupees: 15000,
      unit: U.job,
      covers: LABOUR_2BHK,
    },
    { url: PAINT_C, sentence: PAINT_C1, amount_rupees: 19000, unit: U.job, covers: LABOUR_2BHK },
  ],
};

const COOK_A = "https://cookhire.example/bengaluru/cook-salary";
const COOK_B = "https://maidbook.example/cooks";
const COOK_C = "https://helpers.example/blog/what-cooks-earn";
const COOK_A1 = "A cook for two meals a day for a family of four in Bengaluru costs ₹10,000 to ₹12,000 a month.";
const COOK_B1 = "Part-time cooks in Bengaluru charge ₹9,000 a month for two meals for three people.";
const COOK_B2 = "For a family of six, expect ₹16,000 a month.";
const COOK_C1 = "Most families we place pay ₹11,000 a month for a cook making lunch and dinner.";
const COOK_C2 = "Weekend and stand-in cooks charge ₹540 per visit.";
const COOK_C3 = "Celebrity chefs in Bengaluru can charge ₹2,00,000 a month.";
const FOUR_TWO = { people: 4, meals: 2 };

const COOK: Canned = {
  pages: [
    { url: COOK_A, text: `Cook salary guide. ${COOK_A1}` },
    { url: COOK_B, text: `${COOK_B1} ${COOK_B2}` },
    { url: COOK_C, text: `What cooks earn. ${COOK_C1} ${COOK_C2} ${COOK_C3}` },
  ],
  quotes: [
    { url: COOK_A, sentence: COOK_A1, amount_rupees: 10000, unit: U.month, covers: FOUR_TWO },
    { url: COOK_A, sentence: COOK_A1, amount_rupees: 12000, unit: U.month, covers: FOUR_TWO },
    { url: COOK_B, sentence: COOK_B1, amount_rupees: 9000, unit: U.month, covers: { people: 3, meals: 2 } },
    { url: COOK_B, sentence: COOK_B2, amount_rupees: 16000, unit: U.month, covers: { people: 6 } },
    { url: COOK_C, sentence: COOK_C1, amount_rupees: 11000, unit: U.month, covers: { meals: 2 } },
    { url: COOK_C, sentence: COOK_C2, amount_rupees: 540, unit: U.visit, covers: {} },
    { url: COOK_C, sentence: COOK_C3, amount_rupees: 200000, unit: U.month, covers: {} },
  ],
};

const MAID_A = "https://maidfinder.example/bengaluru";
const MAID_B = "https://homehelp.example/maid-salary";
const MAID_C = "https://cleaners.example/rates";
const MAID_A1 = "A daily maid for sweeping and mopping a 2BHK in Bengaluru costs ₹2,500 to ₹3,500 a month.";
const MAID_B1 = "Expect ₹3,000 a month for daily cleaning of a 2BHK flat.";
const MAID_C1 = "Daily maids for a 2BHK charge ₹4,500 a month with dishes, or ₹5,500 with cooking prep.";
const TWO_ROOMS = { rooms: 2 };

const MAID: Canned = {
  pages: [
    { url: MAID_A, text: MAID_A1 },
    { url: MAID_B, text: `Maid salary in Bengaluru. ${MAID_B1}` },
    { url: MAID_C, text: `Rates. ${MAID_C1}` },
  ],
  quotes: [
    { url: MAID_A, sentence: MAID_A1, amount_rupees: 2500, unit: U.month, covers: TWO_ROOMS },
    { url: MAID_A, sentence: MAID_A1, amount_rupees: 3500, unit: U.month, covers: TWO_ROOMS },
    { url: MAID_B, sentence: MAID_B1, amount_rupees: 3000, unit: U.month, covers: TWO_ROOMS },
    { url: MAID_C, sentence: MAID_C1, amount_rupees: 4500, unit: U.month, covers: TWO_ROOMS },
    { url: MAID_C, sentence: MAID_C1, amount_rupees: 5500, unit: U.month, covers: TWO_ROOMS },
  ],
};

const CANNED: Readonly<Partial<Record<Trade, Canned>>> = { [T.painter]: PAINTER, [T.cook]: COOK, [T.maid]: MAID };

/** The canned pages and quotes for a trade, whatever the scope: the checks decide what fits. */
export class FixtureQuoteSource implements QuoteSource {
  readonly name = SourceName.fixture;

  quotes(req: EstimateRequest): Promise<SourcedQuotes> {
    const canned = CANNED[req.trade];
    if (!canned) return Promise.resolve({ pages: [], quotes: [] });
    // The model names each quote's site too; the checks ignore it and take the site from the page's URL.
    const quotes = canned.quotes.map((q) => ({ ...q, site: new URL(q.url).hostname }));
    return Promise.resolve({ pages: canned.pages, quotes });
  }
}
