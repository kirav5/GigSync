import type { City, Lang, Trade } from "@gigsync/protocol";
import type { Field } from "../interview/lexicon.js";

/**
 * What one chat message asks for (ADR 0040), in Talk or Find: the phone's own model names it when there is one, the
 * word lists when there is none. Naming is all a router does: code runs the action and computes every number.
 */
export const ChatIntent = {
  /** Change a field of the worker's card ("मेरा रेट बदलो"). */
  editCard: "editCard",
  /** Offer to help people new to the worker's city. */
  helpOffer: "helpOffer",
  /** Stop helping newcomers. */
  helpStop: "helpStop",
  /** The worker is moving to a new city for work. */
  moving: "moving",
  /** What the worker earned, from this phone's passbook. */
  earnings: "earnings",
  /** What the market pays for a kind of work ("is ₹8,000 fair for a cook?"). */
  market: "market",
  /** A question the city's guide answers, in a chat about a move. */
  guide: "guide",
  /** Looking for someone to do a job. */
  find: "find",
  /** A note to keep. */
  remember: "remember",
  /** A question about the owner's own notes. */
  askSelf: "askSelf",
  /** A question to one of the owner's contacts. */
  askContact: "askContact",
  /** A rule about what a contact may see or ask. */
  setRule: "setRule",
  /** Anything else. */
  chat: "chat",
} as const;
export type ChatIntent = (typeof ChatIntent)[keyof typeof ChatIntent];

/** The values a route may carry, each one checked by core before it is used. */
export interface ChatSlots {
  trade?: Trade;
  /** A pilot area's key ("hsr_layout"), as `PILOT_AREAS` and the area choices name it. */
  area?: string;
  city?: City;
  /** An amount the owner said, in paise. */
  amount_paise?: number;
  /** One of the owner's contacts, as the owner saved the name. */
  contact?: string;
  /** The card field to change. */
  field?: Field;
  /** The note to keep: the owner's own words. */
  note?: string;
}

/** Who named the intent: the phone's model, or the word lists (no model, too slow, or a reply core rejected). */
export const RouteVia = { model: "model", keywords: "keywords" } as const;
export type RouteVia = (typeof RouteVia)[keyof typeof RouteVia];

export interface ChatRoute {
  intent: ChatIntent;
  slots: ChatSlots;
  via: RouteVia;
}

/** Who is chatting: households look for help in Find; workers talk to their agent in Talk. */
export const ChatRole = { worker: "worker", household: "household" } as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export interface IntentContext {
  lang: Lang;
  role: ChatRole;
  /** The owner's contacts' names. */
  contacts: readonly string[];
  /** A worker's own trades, from their card. */
  trades?: readonly Trade[];
  /** The chat is about a move, so questions the city's guide answers count. */
  inMove?: boolean;
}

/** Intents only a worker has: a household has no card, no newcomers to help, no move and no passbook in its chat. */
const WORKER_ONLY: ReadonlySet<ChatIntent> = new Set([
  ChatIntent.editCard,
  ChatIntent.helpOffer,
  ChatIntent.helpStop,
  ChatIntent.moving,
  ChatIntent.earnings,
]);

/** True when this owner's chat can have the intent: worker-only intents for workers, the guide only in a move. */
export function intentAllowed(intent: ChatIntent, ctx: IntentContext): boolean {
  if (ctx.role === ChatRole.household && WORKER_ONLY.has(intent)) return false;
  return intent !== ChatIntent.guide || ctx.inMove === true;
}

/** The intents a chat can have, in the order the prompt lists them. */
export const allowedIntents = (ctx: IntentContext): ChatIntent[] =>
  Object.values(ChatIntent).filter((intent) => intentAllowed(intent, ctx));
