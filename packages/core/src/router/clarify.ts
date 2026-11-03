import {
  ChatIntent,
  type ChatRoute,
  type IntentContext,
  intentAllowed,
  RouteVia,
  routeComplete,
  withWholeNote,
} from "./intent.js";
import { keywordRoute } from "./keyword-route.js";
import { wordSlots } from "./meaning-route.js";

/**
 * When the phone's language model cannot tell what a message asks for, it says so instead of guessing, and the chat
 * asks the owner which they meant (ADR 0042 amendment 2026-11-03). Code builds the question and its choices, in the
 * owner's language: the model only names the intents it is torn between, and each choice is checked here like any
 * route.
 */

/** The model's answer for "this could mean two or three things". */
export const CLARIFY = "clarify";
/** A question offers two or three of the intents, then "Something else". */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 3;

/** The route for an intent the owner picked: slots read from their words, as the word lists and meaning router do. */
export function chosenRoute(intent: ChatIntent, text: string, ctx: IntentContext): ChatRoute | undefined {
  if (!intentAllowed(intent, ctx)) return undefined;
  const byWords = keywordRoute(text, ctx);
  const read = byWords.intent === intent ? byWords.slots : wordSlots(text, byWords, intent);
  const slots = withWholeNote(intent, read, text);
  return routeComplete(intent, slots, ctx) ? { intent, slots, via: RouteVia.owner } : undefined;
}

/**
 * The route for the intents the model was torn between: the first it named, with the rest as `unsure` so the chat
 * asks. Only intents this chat can act on count, once each and at most MAX_CHOICES; with one left there is nothing
 * to ask, and with none the next reader answers.
 */
export function unsureRoute(named: readonly ChatIntent[], text: string, ctx: IntentContext): ChatRoute | undefined {
  const routes = [...new Set(named)]
    .filter((intent) => intent !== ChatIntent.chat)
    .flatMap((intent) => chosenRoute(intent, text, ctx) ?? [])
    .slice(0, MAX_CHOICES);
  const [first] = routes;
  if (!first) return undefined;
  const route = { ...first, via: RouteVia.model };
  return routes.length < MIN_CHOICES ? route : { ...route, unsure: routes.map((r) => r.intent) };
}

/** What a question offers: the intents the model named, then "Something else", which is chat. */
export const choicesOf = (unsure: readonly ChatIntent[]): ChatIntent[] => [
  ...unsure.filter((intent) => intent !== ChatIntent.chat),
  ChatIntent.chat,
];
