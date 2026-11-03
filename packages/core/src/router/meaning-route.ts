import { PILOT_AREA_CHOICES } from "../estimate/area-names.js";
import { areaIn, tradesIn } from "../interview/lexicon.js";
import { log } from "../log.js";
import type { Embedder } from "../ports.js";
import { EXAMPLES } from "./examples.js";
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
import { type Labelled, MeaningIndex } from "./meaning.js";
import { MORE_SAYINGS } from "./sayings.js";
import { EDGE_SAYINGS } from "./sayings-edges.js";
import { HINGLISH_SAYINGS } from "./sayings-hinglish.js";
import { KANGLISH_SAYINGS } from "./sayings-kanglish.js";

/**
 * The phone's embedding model names a message's intent by its nearest labelled saying (ADR 0042). Like the model
 * router it only names: the slots come from the word lists, which read a trade, an area, a contact or a note out of the
 * owner's own words, and code runs the action. A message too far from every saying, or one whose route lacks what its
 * action needs, is left to the readers after it.
 */

/**
 * The nearest saying must be at least this similar for the label to count. Below it the message is unlike anything
 * labelled, and "chat" by the word lists is the safer answer. Tuned on the eval set (docs/gigsync/intent-eval.md).
 */
export const MIN_SIMILARITY = 0.8;

/** The index's own sayings beyond the prompt's examples: the first set, Hinglish, Kanglish, and the confused edges. */
const OWN_SAYINGS = [MORE_SAYINGS, HINGLISH_SAYINGS, KANGLISH_SAYINGS, EDGE_SAYINGS];

/** Every labelled saying: the prompt's examples and the index's own, flattened, in the intents' order. */
export const INTENT_SAYINGS: readonly Labelled<ChatIntent>[] = Object.values(ChatIntent).flatMap((intent) => [
  ...EXAMPLES[intent].map(({ said }) => ({ said, label: intent })),
  ...OWN_SAYINGS.flatMap((sayings) => (sayings[intent] ?? []).map((said) => ({ said, label: intent }))),
]);

/** The index over the intent sayings for one embedder; the app keeps one for its life. */
export const intentIndex = (embedder: Embedder): MeaningIndex<ChatIntent> => new MeaningIndex(embedder, INTENT_SAYINGS);

export interface MeaningRouteOptions {
  minSimilarity?: number;
}

/**
 * The intent the nearest sayings carry, with the slots the word lists read from the words; undefined when the device
 * has no embedding model, the message is too far from every saying, or the route lacks a slot its action needs.
 */
export async function meaningRoute(
  text: string,
  ctx: IntentContext,
  index: MeaningIndex<ChatIntent>,
  opts?: MeaningRouteOptions,
): Promise<ChatRoute | undefined> {
  if (!text.trim()) return undefined;
  const found = await index.nearest(text, (intent) => intentAllowed(intent, ctx));
  const floor = opts?.minSimilarity ?? MIN_SIMILARITY;
  if (!found || found.top < floor) {
    if (found) log.debug("chat: meaning too far", { top: Number(found.top.toFixed(2)) });
    return undefined;
  }
  // The lists' own reading of the words, kept whole when they heard the same intent; else only the slots that need
  // nothing but the words (a trade, an area, an amount, a contact) are trusted from it.
  const byWords = keywordRoute(text, ctx);
  const read = byWords.intent === found.label ? byWords.slots : wordSlots(text, byWords, found.label);
  const slots = withWholeNote(found.label, read, text);
  return routeComplete(found.label, slots, ctx) ? { intent: found.label, slots, via: RouteVia.meaning } : undefined;
}

/** The intents that act on a contact the lists found by name in the words. */
const CONTACT_INTENTS: ReadonlySet<ChatIntent> = new Set([ChatIntent.askContact, ChatIntent.setRule]);

/**
 * Slots that mean the same whatever the intent, read from the words themselves: a trade, an area, an amount or a
 * city the lists heard, and a contact for the intents that act on one. Never a field, which belongs to the list that
 * read it; a note to keep is then the whole message (`withWholeNote`). The lists may have heard a different intent and read nothing, so the trade and the area are
 * read again by their own word lists.
 */
export function wordSlots(text: string, byWords: ChatRoute, intent: ChatIntent): ChatRoute["slots"] {
  const trade = byWords.slots.trade ?? tradesIn(text)[0];
  const area = byWords.slots.area ?? areaIn(text, PILOT_AREA_CHOICES);
  const { amount_paise, contact, city } = byWords.slots;
  return {
    ...(trade ? { trade } : {}),
    ...(area ? { area } : {}),
    ...(amount_paise ? { amount_paise } : {}),
    ...(city ? { city } : {}),
    ...(contact && CONTACT_INTENTS.has(intent) ? { contact } : {}),
  };
}
