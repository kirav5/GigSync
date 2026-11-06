// The conversations in vectors/find: each is what a person says first, what they answer the model's own questions
// with, and the work they want (a trade, or `outside` the trades). Everything else the chat asks has a fixed answer.
import { readFileSync } from "node:fs";
import { z } from "./core.mjs";

export const SETS = ["en", "hi", "kn", "hinglish", "kanglish"];
const VECTORS = new URL("../../vectors/find/", import.meta.url);

/** The app's language for each set: Hinglish and Kanglish are typed by people whose app is in English. */
export const LANG_OF = { en: "en", hi: "hi", kn: "kn", hinglish: "en", kanglish: "en" };

const Conversation = z.object({
  id: z.string(),
  says: z.array(z.string().min(1)).min(1),
  answers: z.array(z.string().min(1)),
  /** Other work named part-way: the chat should offer to switch, not say "Sorry". */
  later: z.string().optional(),
  want: z.union([
    z.object({ trade: z.string() }),
    z.object({ skill: z.string() }),
    z.object({ outside: z.literal(true) }),
  ]),
});

export function loadConversations(sets = SETS) {
  return sets.flatMap((set) =>
    z
      .array(Conversation)
      .parse(JSON.parse(readFileSync(new URL(`${set}.json`, VECTORS), "utf8")))
      .map((c) => ({ ...c, set })),
  );
}
