import type { Engagement, UserId } from "@collab/protocol";
import { ulid } from "ulid";
import { newEngagement } from "./engagement/machine.js";
import type { Ports } from "./ports.js";
import type { Route } from "./router/keyword.js";

/** A typed card the UI renders. Kept small on purpose; DynamicUI grows this in M1. */
export type Card =
  | { kind: "text"; body: string }
  | { kind: "saved"; body: string; episode: string }
  | { kind: "answer"; body: string; sources: string[] }
  | { kind: "draft"; body: string; engagement: Engagement }
  | { kind: "needs_model"; body: string };

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
    case "remember": {
      const episode: Episode = { id: `ep_${ulid(now.getTime())}`, text: route.text, created_at: now.toISOString() };
      await ports.storage.put("episodes", episode.id, episode);
      return { kind: "saved", body: `Saved: "${route.text}"`, episode: episode.id };
    }
    case "askSelf": {
      const episodes = await ports.storage.list<Episode>("episodes");
      const hits = search(route.text, episodes).slice(0, 3);
      if (hits.length === 0) return { kind: "answer", body: "I have nothing saved about that.", sources: [] };
      const draft = await ports.model.generate(answerPrompt(route.text, hits));
      // Grounding rule: with no model we quote the notes; with one we still show which notes it used.
      const body = draft ?? hits.map((h) => `• ${h.text}`).join("\n");
      return { kind: "answer", body, sources: hits.map((h) => h.id) };
    }
    case "askContact": {
      const contact = contacts.find((c) => c.name.toLowerCase() === route.contact?.toLowerCase());
      if (!contact) return { kind: "text", body: `I don't have ${route.contact} in your contacts yet.` };
      const engagement = newEngagement(
        { role: "requester", counterpart: contact.id, brief: { text: route.text, topic: "question", shared: {} } },
        now,
      );
      await ports.storage.put("engagements", engagement.id, engagement);
      return { kind: "draft", body: `Ask ${contact.name}: "${route.text}"?`, engagement };
    }
    case "setRule":
      return { kind: "text", body: `Rules come in M2. I understood: ${route.text}` };
    case "find":
      return { kind: "text", body: `The marketplace comes in M3. I understood: ${route.text}` };
    default: {
      const reply = await ports.model.generate(route.text);
      return reply
        ? { kind: "text", body: reply }
        : { kind: "needs_model", body: "I need a model for that. Download one in Settings, or ask about your notes." };
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
