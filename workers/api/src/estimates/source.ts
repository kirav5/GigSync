import { LOCAL_ENVIRONMENT } from "@gigsync/core/log";
import type { EstimateRequest } from "@gigsync/protocol";
import type { Env } from "../env.js";
import { AnthropicQuoteSource } from "./anthropic.js";
import { SourceName } from "./constants.js";
import { FixtureQuoteSource } from "./fixture.js";
import type { SourcedQuotes } from "./verify.js";

/**
 * Where quotes for an estimate come from: fetched pages and the prices a reader found on them, unchecked. The checks
 * and arithmetic are the caller's (`webBand`), so a source can be swapped without trusting it.
 */
export interface QuoteSource {
  readonly name: string;
  quotes(req: EstimateRequest): Promise<SourcedQuotes>;
}

/**
 * The fixture only where ENVIRONMENT is local, so a copied setting can never serve canned prices from a deployment;
 * otherwise the model when its key is set; otherwise none, and the route answers "no estimate".
 */
export function quoteSourceFor(env: Env): QuoteSource | undefined {
  if (env.ESTIMATE_SOURCE === SourceName.fixture && env.ENVIRONMENT === LOCAL_ENVIRONMENT) {
    return new FixtureQuoteSource();
  }
  if (env.ANTHROPIC_API_KEY) return new AnthropicQuoteSource(env.ANTHROPIC_API_KEY);
  return undefined;
}
