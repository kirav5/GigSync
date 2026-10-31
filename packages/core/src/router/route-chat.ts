import { log, pii } from "../log.js";
import type { Model } from "../ports.js";
import type { ChatRoute, IntentContext } from "./intent.js";
import { keywordRoute } from "./keyword-route.js";
import { type ModelRouteOptions, modelRoute } from "./model-route.js";

/**
 * One message's route (ADR 0040 §3): the phone's model first, the word lists when it gives none (no usable model, too
 * slow, or a reply core rejected). Chat text never leaves the phone for this: the model is the phone's own.
 */
export async function routeChat(
  text: string,
  ctx: IntentContext,
  model: Model,
  opts?: ModelRouteOptions,
): Promise<ChatRoute> {
  log.debug("chat: routing", { text: pii(text) });
  const route = (await modelRoute(text, ctx, model, opts)) ?? keywordRoute(text, ctx);
  // Who named it and what, never what was said.
  log.info("chat routed", { via: route.via, intent: route.intent });
  return route;
}
