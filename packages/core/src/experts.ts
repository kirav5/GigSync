import { type Booking, type Engagement, Lang, Role, type TermWhen, Trade, type UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { newEngagement } from "./engagement/machine.js";
import type { MessageKey, Params } from "./i18n/t.js";
import { BULLET_MARK, plainReply } from "./model-reply.js";
import { Collection, type Ports } from "./ports.js";
import { Expert, type Route } from "./router/keyword.js";

export const CardKind = {
  text: "text",
  saved: "saved",
  answer: "answer",
  draft: "draft",
  needsModel: "needs_model",
  /** The worker's own schedule (ADR 0048): a line, then bookings and signed jobs the phone writes in its language. */
  schedule: "schedule",
} as const;

/** What the agent says, as a key each phone renders in its owner's language (`t(lang, key, params)`). */
export interface Phrase {
  key: MessageKey;
  params?: Params;
}

/**
 * Words the agent did not write from a key: the owner's own notes, quoted back, or a model's reply. `lang` is set
 * when it is known (the model answers in English), so the phone can translate it for the owner.
 */
export interface Words {
  text: string;
  lang?: Lang;
}

/** A typed card the UI renders. Kept small on purpose; DynamicUI grows this in M1. */
export type Card =
  | { kind: typeof CardKind.text; say: Phrase }
  | { kind: typeof CardKind.text; words: Words }
  | { kind: typeof CardKind.saved; say: Phrase; episode: string }
  | { kind: typeof CardKind.answer; say: Phrase; sources: string[] }
  | { kind: typeof CardKind.answer; words: Words; sources: string[] }
  | { kind: typeof CardKind.draft; say: Phrase; engagement: Engagement }
  | { kind: typeof CardKind.needsModel; say: Phrase }
  | { kind: typeof CardKind.schedule; say: Phrase; bookings: Booking[]; jobs: TermWhen[] };

/** The language the on-device models answer in today (HLD 7.6); their replies are translated on the phone. */
const MODEL_LANG = Lang.enum.en;

/** Two short sentences and a little room: a reply the owner reads at a glance and hears in a breath. */
const REPLY_MAX_TOKENS = 120;

const LINE = "\n";

/** Engagements the agent opens from a chat question. */
const QUESTION_TOPIC = "question";

export interface Episode {
  id: string;
  text: string;
  created_at: string;
}

export interface Contact {
  id: UserId;
  name: string;
}

export async function runExpert(route: Route, ports: Ports, contacts: Contact[]): Promise<Card> {
  const now = ports.clock.now();
  switch (route.expert) {
    case Expert.remember: {
      const episode: Episode = { id: `ep_${ulid(now.getTime())}`, text: route.text, created_at: now.toISOString() };
      await ports.storage.put(Collection.episodes, episode.id, episode);
      return { kind: CardKind.saved, say: { key: "agent.saved", params: { text: route.text } }, episode: episode.id };
    }
    case Expert.askSelf: {
      const episodes = await ports.storage.list<Episode>(Collection.episodes);
      const hits = search(route.text, episodes).slice(0, 3);
      if (hits.length === 0) return { kind: CardKind.answer, say: { key: "agent.nothing" }, sources: [] };
      const answered = await ports.model.generate(answerPrompt(route.text, hits), { maxTokens: REPLY_MAX_TOKENS });
      const draft = answered && plainReply(answered);
      // Grounding rule: with no model we quote the notes; with one we still show which notes it used.
      const words: Words = draft
        ? { text: draft, lang: MODEL_LANG }
        : { text: hits.map((h) => `${BULLET_MARK}${h.text}`).join(LINE) };
      return { kind: CardKind.answer, words, sources: hits.map((h) => h.id) };
    }
    case Expert.askContact: {
      const contact = contacts.find((c) => c.name.toLowerCase() === route.contact?.toLowerCase());
      if (!contact)
        return { kind: CardKind.text, say: { key: "agent.no_contact", params: { name: route.contact ?? "" } } };
      const engagement = newEngagement(
        {
          role: Role.enum.requester,
          counterpart: contact.id,
          brief: { text: route.text, topic: QUESTION_TOPIC, shared: {} },
        },
        now,
      );
      await ports.storage.put(Collection.engagements, engagement.id, engagement);
      return {
        kind: CardKind.draft,
        say: { key: "agent.ask_contact", params: { name: contact.name, text: route.text } },
        engagement,
      };
    }
    case Expert.setRule:
      return { kind: CardKind.text, say: { key: "agent.rules_later", params: { text: route.text } } };
    case Expert.find:
      return { kind: CardKind.text, say: { key: "agent.market_later", params: { text: route.text } } };
    default: {
      const answered = await ports.model.generate(chatPrompt(route.text), { maxTokens: REPLY_MAX_TOKENS });
      const reply = answered && plainReply(answered);
      return reply
        ? { kind: CardKind.text, words: { text: reply, lang: MODEL_LANG } }
        : { kind: CardKind.needsModel, say: { key: "agent.needs_model" } };
    }
  }
}

/** Splits on anything that is not a letter, a combining mark or a digit, so Devanagari and Kannada words stay whole. */
const NOT_WORD = /[^\p{L}\p{M}\p{N}]+/u;
const MIN_WORD = 3;

function search(query: string, episodes: Episode[]): Episode[] {
  const words = query
    .toLowerCase()
    .split(NOT_WORD)
    .filter((w) => w.length >= MIN_WORD);
  return episodes
    .map((e) => ({ e, score: words.filter((w) => e.text.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.created_at.localeCompare(a.e.created_at))
    .map((x) => x.e);
}

/** How every free reply is asked for: the chat shows it as typed, the phone translates it and may read it aloud. */
const REPLY_RULES = "Reply in plain text, with no Markdown, in at most two short sentences.";
const UNDERSCORE = /_/g;
/** The kinds of work GigSync lists, as words: a small model otherwise fills in a trade from anywhere. */
const TRADES = Trade.options.map((trade) => trade.replace(UNDERSCORE, " ")).join(", ");

function answerPrompt(question: string, notes: Episode[]): string {
  return [
    "Answer the owner's question using only these notes. If the notes do not answer it, say you don't know.",
    REPLY_RULES,
    ...notes.map((n, i) => `Note ${i + 1}: ${n.text}`),
    `Question: ${question}`,
  ].join(LINE);
}

/** The chat's prompt: who is answering, the work GigSync knows, and how short; never the owner's words alone. */
function chatPrompt(message: string): string {
  return [
    "You are the owner's own GigSync agent, on their phone in Bengaluru.",
    `GigSync connects households with people who do home work: ${TRADES}.`,
    "Answer the message warmly and only what it asks. If you do not know, say so: never make up jobs, prices, people or kinds of work.",
    REPLY_RULES,
    `Message: ${JSON.stringify(message)}`,
  ].join(LINE);
}
