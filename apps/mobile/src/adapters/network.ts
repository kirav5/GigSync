import { type ConnectionFacts, type Network, networkOf } from "@gigsync/core";

/** The browser's word on the connection; Safari gives none. */
export const currentNetwork = (): Network => networkOf((navigator as { connection?: ConnectionFacts }).connection);

/** A mouse or trackpad as the main pointer: a computer, not a phone or a tablet. */
const COMPUTER_POINTER = "(pointer: fine)";
export const onComputer = (): boolean => globalThis.matchMedia?.(COMPUTER_POINTER).matches ?? false;
