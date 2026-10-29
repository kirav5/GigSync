import { type CityGuide, type GuideSection, Lang } from "@gigsync/protocol";
import { normalize, SPACE } from "../interview/normalize.js";
import type { Model } from "../ports.js";
import { pickSection } from "./ask-model.js";
import { NEED_TERMS, needsIn, startsWord } from "./ask-words.js";

/**
 * "Ask the guide": the owner's question, in their language, answered with one section of the city guide as written,
 * with its sources. The code finds the section by words; a model, when the phone has one, may only choose a section
 * id when the words found none, and the id must be one of the guide's. No model writes any of the answer.
 */

/** How the section was found. */
export const FoundBy = { words: "words", model: "model" } as const;
export type FoundBy = (typeof FoundBy)[keyof typeof FoundBy];

export type GuideAnswer = { section: GuideSection; by: FoundBy } | undefined;

/** A word found among a section's keywords counts most, then in its title, then in its body. */
const Weight = { keyword: 3, title: 2, body: 1 } as const;
/** A section answers only when a word is among its keywords or in its title: a word in a body alone is too loose. */
const MIN_SCORE = Weight.title;
/** English words shorter than this say nothing on their own ("a", "to"). */
const WORD_MIN = 3;
const LATIN = /^[a-z0-9-]+$/;
/** English words in a question that are about asking, not about the need. */
const STOP_WORDS: ReadonlySet<string> = new Set(
  [
    "the and for can how what where when who why which get got find need want should must will would could does did",
    "have has with from into this that there here any some you your our his her they them about near city new please",
    "tell know today now first bengaluru bangalore",
  ]
    .join(SPACE)
    .split(SPACE),
);

/** The English words to look for: the question's own English words, and those of every need it names. */
function termsOf(question: string, lang: Lang): string[] {
  const said = normalize(question);
  const own = said.split(SPACE).filter((w) => w.length >= WORD_MIN && LATIN.test(w) && !STOP_WORDS.has(w));
  const fromNeeds = needsIn(said, lang).flatMap((need) => NEED_TERMS[need]);
  return [...new Set([...own, ...fromNeeds].map(normalize))];
}

function scoreOf(section: GuideSection, terms: readonly string[]): number {
  const keywords = section.keywords.map(normalize);
  const title = normalize(section.title);
  const body = normalize(section.body);
  let score = 0;
  for (const term of terms) {
    const found = startsWord(term);
    if (keywords.some(found)) score += Weight.keyword;
    if (found(title)) score += Weight.title;
    if (found(body)) score += Weight.body;
  }
  return score;
}

/** The section whose keywords, title and body best match the question; the earlier one in the guide on a tie. */
export function findSection(guide: CityGuide, question: string, lang: Lang): GuideSection | undefined {
  const terms = termsOf(question, lang);
  if (terms.length === 0) return undefined;
  let best: { section: GuideSection; score: number } | undefined;
  for (const section of guide.sections) {
    const score = scoreOf(section, terms);
    if (score >= MIN_SCORE && score > (best?.score ?? 0)) best = { section, score };
  }
  return best?.section;
}

/** The answer to the owner's question: a section found by words, else one a model chose from the titles, else none. */
export async function askGuide(
  guide: CityGuide,
  question: string,
  { lang, model, waitMs }: { lang: Lang; model?: Model; waitMs?: number },
): Promise<GuideAnswer> {
  if (!question.trim()) return undefined;
  const found = findSection(guide, question, lang);
  if (found) return { section: found, by: FoundBy.words };
  if (!model || lang !== Lang.enum.en) return undefined;
  const picked = await pickSection(model, guide, question, waitMs);
  return picked ? { section: picked, by: FoundBy.model } : undefined;
}
