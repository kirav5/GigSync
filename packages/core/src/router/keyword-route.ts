import { PILOT_AREA_CHOICES } from "../estimate/area-names.js";
import { editIntent } from "../interview/lexicon.js";
import { asksGuide } from "../moving/guide-replies.js";
import { hasScheduleCue, namesBooking, soundsLikeSchedule } from "../schedule/read.js";
import { earningsIntent } from "./earnings.js";
import { ChatIntent, ChatRole, type ChatRoute, type ChatSlots, type IntentContext, RouteVia } from "./intent.js";
import { Expert, namedContact, routeByKeywords } from "./keyword.js";
import { marketQuestion } from "./market.js";
import { movingIntent } from "./moving.js";
import { HelpIntent, helpIntent } from "./newcomers.js";

/**
 * The word lists as one router (ADR 0040 §3, §5): what answers when the phone has no usable model, the model is too
 * slow, or its reply fails core's checks. The lists run in the order the chats always checked them, so lite mode is
 * unchanged. A worker's Talk: changing the card, helping newcomers, moving, a market question, earnings, their
 * schedule, the city's guide in a chat about a move, then notes, questions and the rest. A household: a market question, then the same
 * finding, notes, questions and the rest (Find itself treats every route but a market question as its need, as before).
 */

const route = (intent: ChatIntent, slots: ChatSlots = {}): ChatRoute => ({ intent, slots, via: RouteVia.keywords });

/** The agent's own experts as chat intents: what is left once no list before them heard anything. */
const EXPERT_INTENT: Readonly<Record<Expert, ChatIntent>> = {
  [Expert.remember]: ChatIntent.remember,
  [Expert.askSelf]: ChatIntent.askSelf,
  [Expert.askContact]: ChatIntent.askContact,
  [Expert.setRule]: ChatIntent.setRule,
  [Expert.find]: ChatIntent.find,
  [Expert.chat]: ChatIntent.chat,
};

/** A market question in either chat: a worker's own trade stands in when they name only an area. */
function marketRoute(text: string, ctx: IntentContext): ChatRoute | undefined {
  const own = ctx.trades?.[0];
  const q = marketQuestion(text, ctx.lang, { areas: PILOT_AREA_CHOICES, ...(own ? { own } : {}) });
  return q && route(ChatIntent.market, { trade: q.trade, ...(q.area ? { area: q.area } : {}) });
}

/** What the agent's experts take: a note, a contact named, or neither. */
function expertRoute(text: string, ctx: IntentContext): ChatRoute {
  const found = routeByKeywords(text, ctx.contacts);
  const intent = EXPERT_INTENT[found.expert];
  if (intent === ChatIntent.remember) return route(intent, { note: found.text });
  return route(intent, found.contact ? { contact: found.contact } : {});
}

/** A worker's Talk, in the order its lists were always checked. */
function workerRoute(text: string, ctx: IntentContext): ChatRoute {
  const field = editIntent(text);
  if (field && !namesBooking(text)) return route(ChatIntent.editCard, { field });
  const help = helpIntent(text, ctx.lang);
  if (help) return route(help === HelpIntent.offer ? ChatIntent.helpOffer : ChatIntent.helpStop);
  const moving = movingIntent(text, ctx.lang);
  if (moving) return route(ChatIntent.moving, moving.city ? { city: moving.city } : {});
  const market = marketRoute(text, ctx);
  if (market) return market;
  if (earningsIntent(text, ctx.lang)) return route(ChatIntent.earnings);
  // Before notes: "save my booking for tomorrow 2-3PM" is a booking, not words to keep (ADR 0048 §2). A contact named
  // makes it about them: "let Ravi see my schedule" is a rule.
  if (soundsLikeSchedule(text) && !namedContact(text, ctx.contacts)) return route(ChatIntent.schedule);
  if (ctx.inMove && asksGuide(text, ctx.lang)) return route(ChatIntent.guide);
  return expertRoute(text, ctx);
}

/**
 * The words bear the intent a model named: a schedule route needs a time, a booking word or work on a day in the
 * words themselves (`hasScheduleCue`); every other intent stands on its slots (`routeComplete`).
 */
export const wordsBear = (intent: ChatIntent, text: string): boolean =>
  intent !== ChatIntent.schedule || hasScheduleCue(text);

/** The intent the word lists hear in one message, with the slots they read. Never fails: "chat" is the rest. */
export function keywordRoute(text: string, ctx: IntentContext): ChatRoute {
  if (ctx.role === ChatRole.household) return marketRoute(text, ctx) ?? expertRoute(text, ctx);
  return workerRoute(text, ctx);
}
