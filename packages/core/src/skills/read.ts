import { type Lang, type Skill, type SkillProblem, skillProblem, type Trade } from "@gigsync/protocol";
import { tradeNamed } from "../interview/lexicon.js";
import { categoryNamed } from "./suggest.js";

/**
 * A skill as a worker typed or said it (ADR 0047 §2, §3): one of the trades when the words are clearly that trade, so
 * it keeps its questions and estimates; else the worker's own words, tagged with their language and, when the words are
 * a kind of work's name, that kind (ADR 0059), when a card may list them; else why not.
 */
export type SkillRead = { trade: Trade } | { skill: Skill } | { problem: SkillProblem };

const SPACES = /\s+/gu;

export function readSkill(text: string, lang: Lang): SkillRead {
  const trade = tradeNamed(text);
  if (trade) return { trade };
  const words = text.trim().replace(SPACES, " ");
  const problem = skillProblem(words);
  if (problem) return { problem };
  const category = categoryNamed(words);
  return { skill: { text: words, lang, ...(category ? { category } : {}) } };
}

/** Words around a spoken skill that only say "I am" or "I do" ("I am a tailor", "मैं दर्ज़ी हूँ"), in any of the scripts. */
const FILLER = new Set([
  "i",
  "im",
  "i'm",
  "am",
  "a",
  "an",
  "do",
  "main",
  "hoon",
  "hun",
  "मैं",
  "हूँ",
  "हूं",
  "हूँ।",
  "ನಾನು",
  "ಮಾಡುತ್ತೇನೆ",
]);

/** A skill as the card interview heard it, without the filler words at either end; the rest as said. */
export function spokenSkill(text: string): string {
  const words = text.trim().split(SPACES);
  const filler = (w: string | undefined) => w !== undefined && FILLER.has(w.toLowerCase());
  while (words.length > 1 && filler(words[0])) words.shift();
  while (words.length > 1 && filler(words.at(-1))) words.pop();
  return words.join(" ");
}
