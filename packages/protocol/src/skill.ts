import { z } from "zod";
import { Lang } from "./lang.js";

/**
 * A worker's own skill (ADR 0047): work outside the trades, in the worker's words ("Tailor", "मेहंदी", "ತೋಟಗಾರ"). The
 * board is public, so the words are held to a name for work: short, letters only, nothing blocked. Phones check before
 * publishing and the server checks every card it stores, with these same rules.
 */

/** At most this many skills on one card; trades and skills together stay within `MAX_TRADES`. */
export const MAX_SKILLS = 3;
/** The most skills `GET /v1/board/skills` lists, most-listed first. */
export const MAX_SKILL_LIST = 500;
export const SKILL_MIN = 2;
export const SKILL_MAX = 40;
/** A name for work, not a sentence. */
export const SKILL_MAX_WORDS = 4;

/**
 * Letters and combining marks in any script, spaces, and `- ' & / .`: no digits (phone numbers, prices), no `@` or
 * `:` (emails, links). The joiners Indic keyboards type are allowed too; they are taken out before this check.
 */
const SKILL_CHARS = /^[\p{L}\p{M}\s\-'’&/.]+$/u;
const JOINERS = /\u200c|\u200d/gu;
const PUNCTUATION = /[-'’&/.]/g;
const SPACES = /\s+/u;
/** The one space `skillKey` leaves between words. */
const SPACE = " ";

/**
 * Words a skill may not contain, as the start of any of its words: sexual services, weapons and drugs, in English,
 * Hindi, Kannada and their romanised forms. A short list that stops the obvious; suspension of the account is the
 * real control (ADR 0047 §3).
 */
const BLOCKED_STEMS: readonly string[] = [
  "sex",
  "escort",
  "prostitut",
  "callgirl",
  "porn",
  "nude",
  "gun",
  "pistol",
  "weapon",
  "drug",
  "ganja",
  "cocaine",
  "heroin",
  "charas",
  "randi",
  "veshya",
  "bandook",
  "hathiyar",
  "सेक्स",
  "वेश्या",
  "रंडी",
  "हथियार",
  "बंदूक",
  "गांजा",
  "ड्रग",
  "ಸೆಕ್ಸ್",
  "ವೇಶ್ಯ",
  "ಬಂದೂಕು",
  "ಗಾಂಜಾ",
  "ಡ್ರಗ್",
];
/** Two words that are blocked only together. */
const BLOCKED_PAIRS: readonly string[] = ["call girl", "body massage"];

/**
 * The key one skill is matched and searched by: Unicode NFKC, lower case, punctuation as spaces, one space between
 * words. "Tailor", "tailor " and "TAILOR" are one skill; "darzi" and "ದರ್ಜಿ" are others (ADR 0047 §5).
 */
export const skillKey = (text: string): string =>
  text.normalize("NFKC").toLowerCase().replace(PUNCTUATION, SPACE).trim().split(SPACES).join(SPACE);

/** Why a skill cannot go on a card; each phone shows the reason in its owner's language. */
export const SkillProblem = z.enum(["length", "words", "characters", "blocked"]);
export type SkillProblem = z.infer<typeof SkillProblem>;

/** What is wrong with a skill's words, or undefined when they may go on a card. */
export function skillProblem(text: string): SkillProblem | undefined {
  const trimmed = text.trim();
  const key = skillKey(trimmed);
  if ([...trimmed].length < SKILL_MIN || [...trimmed].length > SKILL_MAX || key.length < SKILL_MIN)
    return SkillProblem.enum.length;
  if (!SKILL_CHARS.test(trimmed.replace(JOINERS, ""))) return SkillProblem.enum.characters;
  const words = key.split(SPACE);
  if (words.length > SKILL_MAX_WORDS) return SkillProblem.enum.words;
  const joined = words.join("");
  const blocked =
    words.some((w) => BLOCKED_STEMS.some((stem) => w.startsWith(stem))) ||
    BLOCKED_STEMS.some((stem) => joined.startsWith(stem)) ||
    BLOCKED_PAIRS.some((pair) => key.includes(pair));
  return blocked ? SkillProblem.enum.blocked : undefined;
}

/** A skill's words, as they may go on a card. */
export const SkillText = z
  .string()
  .trim()
  .refine((text) => skillProblem(text) === undefined, "not a skill a card may list");

/** A skill as a card lists it and a request asks for it: the worker's words and the language they are in. */
export const Skill = z.object({ text: SkillText, lang: Lang });
export type Skill = z.infer<typeof Skill>;

/** A skill's search key, as the board's list gives it and a search sends it back. */
export const SkillKey = z
  .string()
  .min(SKILL_MIN)
  .max(SKILL_MAX)
  .refine((key) => skillKey(key) === key, "a normalised skill key");
export type SkillKey = z.infer<typeof SkillKey>;

/** No skill twice on one card, by key. */
export const distinctSkills = (skills: readonly Skill[]): boolean =>
  new Set(skills.map((s) => skillKey(s.text))).size === skills.length;

/** One listed skill on `GET /v1/board/skills`: a worker's words for it, its key, and how many workers list it. */
export const BoardSkill = z.object({ key: SkillKey, text: SkillText, lang: Lang, workers: z.number().int().min(1) });
export type BoardSkill = z.infer<typeof BoardSkill>;

export const BoardSkills = z.object({ skills: z.array(BoardSkill).max(MAX_SKILL_LIST) });
export type BoardSkills = z.infer<typeof BoardSkills>;
