import { log, pii } from "../log.js";
import type { Model } from "../ports.js";
import type { ChatIntent, ChatRoute, IntentContext } from "./intent.js";
import { keywordRoute } from "./keyword-route.js";
import type { MeaningIndex } from "./meaning.js";
import { type MeaningRouteOptions, meaningRoute } from "./meaning-route.js";
import { type ModelRouteOptions, modelRoute } from "./model-route.js";

export interface RouteChatOptions extends ModelRouteOptions, MeaningRouteOptions {
  /** The phone's embedding index over the intent sayings; absent on a device without an embedding model. */
  meaning?: MeaningIndex<ChatIntent> | undefined;
}

/**
 * One message's route (ADR 0040 §3, ADR 0042): the phone's embedding model first, by nearest labelled saying; the
 * phone's language model when the message is too far from every saying; the word lists when neither gives a route (no
 * usable model, too slow, or a reply core rejected). Chat text never leaves the phone for this.
 */
export async function routeChat(
  text: string,
  ctx: IntentContext,
  model: Model,
  opts?: RouteChatOptions,
): Promise<ChatRoute> {
  log.debug("chat: routing", { text: pii(text) });
  const byMeaning = opts?.meaning ? await meaningRoute(text, ctx, opts.meaning, opts) : undefined;
  const route = byMeaning ?? (await modelRoute(text, ctx, model, opts)) ?? keywordRoute(text, ctx);
  // Who named it and what, never what was said.
  log.info("chat routed", { via: route.via, intent: route.intent });
  return route;
}
