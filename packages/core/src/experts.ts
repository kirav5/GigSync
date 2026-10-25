import { type Engagement, Role, type UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { newEngagement } from "./engagement/machine.js";
import { Collection, type Ports } from "./ports.js";
import { Expert, type Route } from "./router/keyword.js";

export const CardKind = {
  text: "text",
  saved: "saved",
  answer: "answer",
  draft: "draft",
  needsModel: "needs_model",
} as const;

/** A typed card the UI renders. Kept small on purpose; DynamicUI grows this in M1. */
export type Card =
  | { kind: typeof CardKind.text; body: string }
  | { kind: typeof CardKind.saved; body: string; episode: string }
  | { kind: typeof CardKind.answer; body: string; sources: string[] }
  | { kind: typeof CardKind.draft; body: string; engagement: Engagement }
  | { kind: typeof CardKind.needsModel; body: string };

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
      return { kind: CardKind.saved, body: `Saved: "${route.text}"`, episode: episode.id };
    }
    case Expert.askSelf: {
      const episodes = await ports.storage.list<Episode>(Collection.episodes);
      const hits = search(route.text, episodes).slice(0, 3);
      if (hits.length === 0) return { kind: CardKind.answer, body: "I have nothing saved about that.", sources: [] };
      const draft = await ports.model.generate(answerPrompt(route.text, hits));
      // Grounding rule: with no model we quote the notes; with one we still show which notes it used.
      const body = draft ?? hits.map((h) => `• ${h.text}`).join("\n");
      return { kind: CardKind.answer, body, sources: hits.map((h) => h.id) };
    }
    case Expert.askContact: {
      const contact = contacts.find((c) => c.name.toLowerCase() === route.contact?.toLowerCase());
      if (!contact) return { kind: CardKind.text, body: `I don't have ${route.contact} in your contacts yet.` };
      const engagement = newEngagement(
        {
          role: Role.enum.requester,
          counterpart: contact.id,
          brief: { text: route.text, topic: QUESTION_TOPIC, shared: {} },
        },
        now,
      );
      await ports.storage.put(Collection.engagements, engagement.id, engagement);
      return { kind: CardKind.draft, body: `Ask ${contact.name}: "${route.text}"?`, engagement };
    }
    case Expert.setRule:
      return { kind: CardKind.text, body: `Rules come in M2. I understood: ${route.text}` };
    case Expert.find:
      return { kind: CardKind.text, body: `The marketplace comes in M3. I understood: ${route.text}` };
    default: {
      const reply = await ports.model.generate(route.text);
      return reply
        ? { kind: CardKind.text, body: reply }
        : {
            kind: CardKind.needsModel,
            body: "I need a model for that. Download one in Settings, or ask about your notes.",
          };
    }
  }
}

function search(query: string, episodes: Episode[]): Episode[] {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return episodes
    .map((e) => ({ e, score: words.filter((w) => e.text.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.created_at.localeCompare(a.e.created_at))
    .map((x) => x.e);
}

function answerPrompt(question: string, notes: Episode[]): string {
  return [
    "Answer the owner's question using only these notes. If the notes do not answer it, say you don't know.",
    ...notes.map((n, i) => `Note ${i + 1}: ${n.text}`),
    `Question: ${question}`,
  ].join("\n");
}
