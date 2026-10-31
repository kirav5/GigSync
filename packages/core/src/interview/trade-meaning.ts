import { Trade } from "@gigsync/protocol";
import type { Embedder } from "../ports.js";
import { type Labelled, MeaningIndex } from "../router/meaning.js";

/**
 * The trade a need describes, by meaning (ADR 0042): when the word lists hear no trade in "i want to get my house
 * cleaned", the phone's embedding model places the sentence next to the sayings below and the closest trade's label
 * wins. English sayings for now: the lists read every language, and the eval decides when other languages join.
 */

const T = Trade.enum;

/** How a household describes each trade's work, as said, not as the catalog names it. */
const TRADE_SAYINGS: Readonly<Record<Trade, readonly string[]>> = {
  [T.electrician]: [
    "electrician",
    "fix the wiring",
    "fan not working",
    "switch board sparking",
    "light not turning on",
    "install a ceiling fan",
    "power socket is dead",
    "tube light keeps flickering",
    "fan runs slow and makes noise",
  ],
  [T.plumber]: [
    "plumber",
    "tap is leaking",
    "pipe burst",
    "toilet flush broken",
    "drain blocked",
    "kitchen sink clogged",
    "water dripping from the ceiling",
  ],
  [T.maid]: [
    "maid",
    "house cleaning",
    "get my house cleaned",
    "sweeping and mopping",
    "wash the utensils",
    "domestic help for housework",
    "someone to clean the flat every week",
    "deep clean after renovation",
  ],
  [T.carpenter]: [
    "carpenter",
    "fix the door",
    "make a wooden shelf",
    "repair furniture",
    "cupboard hinge broken",
    "new wardrobe for the bedroom",
    "door does not shut properly",
  ],
  [T.ac_technician]: [
    "ac technician",
    "air conditioner service",
    "ac not cooling",
    "ac gas refill",
    "split ac repair",
    "ac leaking water inside",
  ],
  [T.painter]: [
    "painter",
    "paint the walls",
    "whitewash the house",
    "repaint my flat",
    "exterior painting",
    "putty and paint",
  ],
  [T.cook]: ["cook", "someone to make food", "daily meals", "chef for home", "prepare breakfast and dinner"],
  [T.driver]: ["driver", "someone to drive my car", "chauffeur", "drive me to office daily", "car driver needed"],
};

/**
 * A trade's work must sound at least this much like a saying; a stranger sentence names no trade. Set from the probe
 * sentences in the ADR: small talk and work outside the trades scored up to 0.854 against these sayings, real needs
 * from 0.864 up, so a false trade in the need interview is rarer than a missed one, which the chips then catch.
 */
export const TRADE_MIN_SIMILARITY = 0.86;

export const TRADE_LABELLED: readonly Labelled<Trade>[] = Trade.options.flatMap((trade) =>
  TRADE_SAYINGS[trade].map((said) => ({ said, label: trade })),
);

/** The index over the trade sayings for one embedder; the app keeps one for its life. */
export const tradeIndex = (embedder: Embedder): MeaningIndex<Trade> => new MeaningIndex(embedder, TRADE_LABELLED);

/** The trade a sentence most sounds like, or undefined when none is close enough or the device has no model. */
export async function tradeByMeaning(index: MeaningIndex<Trade>, text: string): Promise<Trade | undefined> {
  if (!text.trim()) return undefined;
  const found = await index.nearest(text, () => true);
  return found && found.top >= TRADE_MIN_SIMILARITY ? found.label : undefined;
}
