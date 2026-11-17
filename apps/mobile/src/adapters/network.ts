import { type ConnectionFacts, type Network, networkOf } from "@gigsync/core";

/** The browser's word on the connection; Safari gives none. */
export const currentNetwork = (): Network => networkOf((navigator as { connection?: ConnectionFacts }).connection);
