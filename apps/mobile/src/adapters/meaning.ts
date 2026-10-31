import { type ChatIntent, intentIndex, type MeaningIndex, type Ports, problemIndex, tradeIndex } from "@gigsync/core";
import type { Trade } from "@gigsync/protocol";

/** The indexes core keeps over its labelled sayings, one set per ports, embedded once for the app's life. */
export interface MeaningIndexes {
  intents: MeaningIndex<ChatIntent>;
  trades: MeaningIndex<Trade>;
  /** Kinds of repair job per trade, labelled `trade/kind`. */
  problems: MeaningIndex<string>;
}

const INDEXES = new WeakMap<Ports, MeaningIndexes>();

/** The indexes for these ports, or undefined when the device has no embedder. */
export function meaningFor(ports: Ports): MeaningIndexes | undefined {
  if (!ports.embedder) return undefined;
  let found = INDEXES.get(ports);
  if (!found) {
    const e = ports.embedder;
    found = { intents: intentIndex(e), trades: tradeIndex(e), problems: problemIndex(e) };
    INDEXES.set(ports, found);
  }
  return found;
}
