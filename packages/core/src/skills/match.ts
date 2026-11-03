import type { BoardSkill } from "@gigsync/protocol";
import { distance, finder, normalize, SPACE } from "../interview/normalize.js";
import { TRADE_MIN_SIMILARITY } from "../interview/trade-meaning.js";
import type { Embedder } from "../ports.js";
import { MeaningIndex } from "../router/meaning.js";

/**
 * Which listed skill a household's words ask for (ADR 0047 §4), on the phone: the words never leave it. By text first:
 * a skill's name inside the words ("tailor" in "I need a tailor"), or within a letter or two of a run of them
 * ("tailer"); then, on a phone with the embedding model, by meaning ("someone to stitch a blouse" near "Tailor").
 */

/** Names shorter than this match only exactly: one changed letter in a short word is another word. */
const FUZZY_MIN = 4;
/** Names up to this long allow one changed letter; longer ones two. */
const SHORT_NAME = 6;
const SHORT_SLIP = 1;
const LONG_SLIP = 2;
/** The most listed skills embedded for the meaning match: embedding is slow on a phone, the most-listed come first. */
export const SKILL_MEANING_MAX = 100;
/**
 * The meaning match uses the trades' bar (ADR 0042): calibrated on trade sayings, not on skill names, so it errs
 * towards no match; a miss leaves the need outside the list, as before, and the owner can name the work again.
 */
export const SKILL_MIN_SIMILARITY = TRADE_MIN_SIMILARITY;

/** How many letters a name is off from the closest run of as many words, within the slip it allows. */
function slipOf(words: readonly string[], name: string): number | undefined {
  const letters = [...name].length;
  if (letters < FUZZY_MIN) return undefined;
  const allowed = letters <= SHORT_NAME ? SHORT_SLIP : LONG_SLIP;
  const size = name.split(SPACE).length;
  let best: number | undefined;
  for (let i = 0; i + size <= words.length; i++) {
    const d = distance(words.slice(i, i + size).join(SPACE), name);
    if (d <= allowed && (best === undefined || d < best)) best = d;
  }
  return best;
}

interface Hit {
  skill: BoardSkill;
  slip: number;
  letters: number;
}

/** Fewer slips first, then the longer name ("blouse stitching" over "stitching"), then the most-listed. */
const better = (a: Hit, b: Hit | undefined): boolean =>
  !b ||
  a.slip < b.slip ||
  (a.slip === b.slip && (a.letters > b.letters || (a.letters === b.letters && a.skill.workers > b.skill.workers)));

/** The listed skill the words name, by text; undefined when none is close. */
export function skillNamedIn(text: string, list: readonly BoardSkill[]): BoardSkill | undefined {
  const said = normalize(text);
  const words = said.split(SPACE);
  let best: Hit | undefined;
  for (const skill of list) {
    const name = normalize(skill.text);
    if (!name) continue;
    const slip = finder(name)(said) >= 0 ? 0 : slipOf(words, name);
    const hit = slip === undefined ? undefined : { skill, slip, letters: [...name].length };
    if (hit && better(hit, best)) best = hit;
  }
  return best?.skill;
}

/** The listed skills by meaning, for one embedder and one list; the app keeps one per list it fetched. */
export const skillIndex = (embedder: Embedder, list: readonly BoardSkill[]): MeaningIndex<string> =>
  new MeaningIndex(
    embedder,
    list.slice(0, SKILL_MEANING_MAX).map((s) => ({ said: s.text, label: s.key })),
  );

/** The listed skill the words name, by text, else by meaning when there is an index; undefined when none is close. */
export async function listedSkill(
  text: string,
  list: readonly BoardSkill[],
  index?: MeaningIndex<string>,
): Promise<BoardSkill | undefined> {
  const named = skillNamedIn(text, list);
  if (named || !index || !text.trim()) return named;
  const found = await index.nearest(text, () => true);
  return found && found.top >= SKILL_MIN_SIMILARITY ? list.find((s) => s.key === found.label) : undefined;
}
