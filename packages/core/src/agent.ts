import { type Card, type Contact, runExpert } from "./experts.js";
import { log, pii } from "./log.js";
import { Collection, type Ports } from "./ports.js";
import { ChatIntent, type ChatRoute, type IntentContext } from "./router/intent.js";
import { Expert, type Route } from "./router/keyword.js";
import type { MeaningIndex } from "./router/meaning.js";
import { intentIndex } from "./router/meaning-route.js";
import { routeChat } from "./router/route-chat.js";

/** Who is asking, without the contacts: the agent reads those from this owner's storage. */
export type RouteContext = Omit<IntentContext, "contacts">;

/** The agent's experts by the intent that reaches them; any other intent the agent is handed is chat. */
const EXPERT: Partial<Record<ChatIntent, Expert>> = {
  [ChatIntent.remember]: Expert.remember,
  [ChatIntent.askSelf]: Expert.askSelf,
  [ChatIntent.askContact]: Expert.askContact,
  [ChatIntent.setRule]: Expert.setRule,
  [ChatIntent.find]: Expert.find,
};

/** What an expert takes from a route: a note is kept as the owner's own words, anything else as said. */
function expertRoute(text: string, { intent, slots }: ChatRoute): Route {
  const expert = EXPERT[intent] ?? Expert.chat;
  const words = expert === Expert.remember ? (slots.note ?? text) : text;
  return { expert, text: words, ...(slots.contact ? { contact: slots.contact } : {}) };
}

/**
 * One message in, one route, and for the agent's own experts (notes, questions, contacts, finding, chat) one card out.
 * Routing is `routeChat` alone (ADR 0040, ADR 0042): the phone's language model when it has one, then its embedding
 * model, the word lists otherwise.
 */
export class Agent {
  /** The index over the intent sayings, embedded once for this agent's life; none on a device without an embedder. */
  private readonly meaning: MeaningIndex<ChatIntent> | undefined;

  constructor(private ports: Ports) {
    this.meaning = ports.embedder ? intentIndex(ports.embedder) : undefined;
  }

  /** The message's route, with this owner's contacts as the names a route may carry. */
  async route(text: string, ctx: RouteContext): Promise<ChatRoute> {
    const contacts = await this.ports.storage.list<Contact>(Collection.contacts);
    const full = { ...ctx, contacts: contacts.map((c) => c.name) };
    return routeChat(text, full, this.ports.model, { meaning: this.meaning });
  }

  /** The card for a routed message, from the expert its intent names. */
  async answer(text: string, chat: ChatRoute): Promise<Card> {
    const start = Date.now();
    const contacts = await this.ports.storage.list<Contact>(Collection.contacts);
    const route = expertRoute(text, chat);
    log.debug("chat: expert", { expert: route.expert, contact: pii(route.contact), text: pii(route.text) });
    const card = await runExpert(route, this.ports, contacts);
    log.debug("chat: reply", { kind: card.kind, card: pii(JSON.stringify(card)) });
    // What happened, never what was said: the expert, the outcome, the size of the message and the time taken.
    log.info("chat handled", { expert: route.expert, card: card.kind, chars: text.length, ms: Date.now() - start });
    return card;
  }
}
