import { Lang, type Trade } from "@gigsync/protocol";
import type { AreaChoice } from "../interview/card.js";
import { amountIn, jobIn } from "../interview/need-parse.js";
import { normalize } from "../interview/normalize.js";
import { startsWord, type WordTest } from "../landing/ask-words.js";
import { earningsIntent } from "./earnings.js";
import type { ChatSlots } from "./intent.js";

const L = Lang.enum;

/**
 * What a worker in Talk or a household in Find says to ask what the market pays (ADR 0039 §2): "what do cooks charge
 * in Jayanagar?", "painting a 2BHK price", "जयनगर में कुक कितना लेते हैं", "ಜಯನಗರದಲ್ಲಿ ಅಡುಗೆಯವರ ದರ ಎಷ್ಟು". Price words
 * by language, matched at the start of a word with any ending; English counts in every language, since owners mix it
 * in. The trade, the area and the job's size come from the same words, read as a need is (`parseNeed`).
 *
 * Not a market question: words that ask what the owner earned (Talk answers those from the passbook), or words that
 * state an amount ("need a cook, pay 12000" is a need with a budget, not a question).
 */
const PRICE: Readonly<Record<Lang, readonly string[]>> = {
  [L.en]: ["charge", "price", "rate", "cost", "how much", "pay", "salary", "fee", "going rate"],
  [L.hi]: [
    "कितना लेत",
    "कितने लेत",
    "कितना लग",
    "कितने लग",
    "कितना चार्ज",
    "रेट",
    "दाम",
    "कीमत",
    "क़ीमत",
    "भाव",
    "चार्ज",
    "खर्च",
    "ख़र्च",
    "तनख्वाह",
    "सैलरी",
    "kitna lete",
    "kitne lete",
    "kitna lagta",
    "kitna lagega",
    "daam",
    "kharcha",
  ],
  [L.kn]: ["ದರ", "ಬೆಲೆ", "ರೇಟ್", "ಎಷ್ಟು ತೆಗೆದುಕೊಳ್ಳ", "ಎಷ್ಟು ಆಗುತ್ತ", "ಎಷ್ಟು ಚಾರ್ಜ್", "ಚಾರ್ಜ್", "ಖರ್ಚು", "ಸಂಬಳ"],
};

const tests = (words: readonly string[]): readonly WordTest[] => words.map(startsWord);
const PRICE_TESTS: Readonly<Record<Lang, readonly WordTest[]>> = {
  [L.en]: tests(PRICE[L.en]),
  [L.hi]: tests([...PRICE[L.en], ...PRICE[L.hi]]),
  [L.kn]: tests([...PRICE[L.en], ...PRICE[L.kn]]),
};

/** A market question: the trade asked about, the area named (a pilot area's key) and the job's size, as said. */
export interface MarketQuestion {
  trade: Trade;
  area?: string;
  details: Readonly<Record<string, string>>;
  /** An amount the owner asks about ("is ₹8,000 fair?"), in paise: the answer says where it falls in the range. */
  amount_paise?: number;
}

export interface MarketOptions {
  /** The pilot's areas and every name each is said by. */
  areas: readonly AreaChoice[];
  /** The asker's own trade (a worker's card), for "what is the rate in Jayanagar?" said with an area but no trade. */
  own?: Trade;
}

/** The market question the owner's words ask, or undefined when they ask none. */
export function marketQuestion(text: string, lang: Lang, o: MarketOptions): MarketQuestion | undefined {
  const said = normalize(text);
  if (said.length === 0 || !PRICE_TESTS[lang].some((heard) => heard(said))) return undefined;
  if (earningsIntent(text, lang) || amountIn(text, false) !== undefined) return undefined;
  const fill = jobIn(text, o.areas);
  const trade = fill.trade ?? (fill.area ? o.own : undefined);
  if (!trade) return undefined;
  return { trade, ...(fill.area ? { area: fill.area } : {}), details: fill.details };
}

/**
 * The market question a routed message asks: the trade, area and amount the route named (each already checked), the
 * asker's own trade when it named none, and the job's size read from the words. Undefined without any trade to price.
 */
export function marketOfRoute(text: string, slots: ChatSlots, o: MarketOptions): MarketQuestion | undefined {
  const trade = slots.trade ?? o.own;
  if (!trade) return undefined;
  const { details } = jobIn(text, o.areas);
  return {
    trade,
    ...(slots.area ? { area: slots.area } : {}),
    details,
    ...(slots.amount_paise ? { amount_paise: slots.amount_paise } : {}),
  };
}
