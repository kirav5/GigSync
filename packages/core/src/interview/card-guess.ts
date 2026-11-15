import { isTradeKind, type Skill, skillKey, type WorkKind } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { closestKinds } from "../skills/closest.js";
import { kindKey, kindValue } from "../skills/kinds.js";
import { type CardDraft, type InterviewState, Pick, retry, Slot, start } from "./card.js";
import type { Line, Prompt } from "./card-lines.js";
import { isSkip, yesNo } from "./lexicon.js";

/**
 * Work the worker added in their own words on the work step ("i sharpen wood"), worked out with them in the card chat:
 * "You said “i sharpen wood”. Is this closest to Carpenter?", the kinds closest to the words as chips (the same ones
 * the work step showed), then Something else. A kind picked files the words under it; Something else keeps them on
 * the card as they are, which a card can hold (ADR 0047). Only the worker's pick files them, never the guess alone.
 */

export interface Filing {
  /** The words as the card holds them until they are settled. */
  skill: Skill;
  /** As the worker typed or said them, for the question. */
  said: string;
  guesses: readonly WorkKind[];
  /** Their other words still to ask about, each with what they typed. */
  rest: readonly OwnWords[];
}

/** One piece of work in the worker's own words: the skill the card holds, and what they typed. */
export interface OwnWords {
  skill: Skill;
  said: string;
}

/** Unclear answers to the question before the words are kept as they are. */
const MAX_MISSES = 2;

const keptLine = (skill: Skill): Line => ({ key: "iv.skill_kept", params: { skill: skill.text } });

/**
 * The next of the worker's own words asked about, or, with none left, the interview at its next detail. Words close to
 * no kind are kept as they are, with a line saying so: there is nothing to offer.
 */
export function fileNext(
  s: InterviewState,
  draft: CardDraft,
  unsure: readonly OwnWords[],
  notes: readonly Line[],
): InterviewState {
  const resumed = { ...start(s.config, draft), fresh: s.fresh, notes };
  const [next, ...rest] = unsure;
  if (!next) return resumed;
  const guesses = closestKinds(next.said);
  if (guesses.length === 0) return fileNext(s, draft, rest, [...notes, keptLine(next.skill)]);
  return { ...resumed, slot: Slot.trade, filing: { ...next, guesses, rest } };
}

/** The words filed under the kind picked: a trade takes their place, another kind keeps them, tagged with it. */
function settle(s: InterviewState, f: Filing, kind: WorkKind): InterviewState {
  const key = skillKey(f.skill.text);
  const others = (s.draft.skills ?? []).filter((sk) => skillKey(sk.text) !== key);
  const trades = s.draft.trades ?? [];
  const draft: CardDraft = isTradeKind(kind)
    ? { ...s.draft, trades: trades.includes(kind) ? trades : [...trades, kind], skills: others }
    : {
        ...s.draft,
        skills: others.some((sk) => sk.category === kind) ? others : [...others, { ...f.skill, category: kind }],
      };
  const filed: Line = { key: "iv.custom_filed", names: { work: [kindKey(kind)] } };
  return fileNext({ ...s, fresh: false }, draft, f.rest, [filed]);
}

const keep = (s: InterviewState, f: Filing): InterviewState =>
  fileNext({ ...s, fresh: false }, s.draft, f.rest, [keptLine(f.skill)]);

export function filingPrompt(s: InterviewState): Prompt {
  const own = s.config.own;
  const { said, guesses } = s.filing ?? { said: "", guesses: [] };
  const [only] = guesses;
  const line: Line =
    guesses.length === 1 && only
      ? { key: "iv.custom_one", params: { words: said }, names: { work: [kindKey(only)] } }
      : { key: "iv.custom_many", params: { words: said } };
  return {
    lines: [line],
    choices: [
      ...guesses.map((k) => ({ value: kindValue(k), key: kindKey(k) })),
      { value: Pick.none, key: "need.guess_else" },
    ],
    hints: [...guesses.map((k) => t(own, kindKey(k))), t(own, "need.guess_else")],
  };
}

/** A tap: a kind offered files the words under it; Something else keeps them. */
export function chooseFiling(s: InterviewState, value: string): InterviewState {
  const f = s.filing;
  if (!f) return s;
  if (value === Pick.none) return keep(s, f);
  const kind = f.guesses.find((k) => kindValue(k) === value);
  return kind ? settle(s, f, kind) : s;
}

/**
 * An answer in words: yes to the one kind offered files it, no keeps the words, and a kind named ("carpenter", "बढ़ई")
 * files that one, offered or not. Anything else asks again, then keeps the words.
 */
export function hearFiling(s: InterviewState, text: string): InterviewState {
  const f = s.filing;
  if (!f) return s;
  const yes = yesNo(text);
  const [only] = f.guesses;
  if (yes === true && f.guesses.length === 1 && only) return settle(s, f, only);
  if (yes === false || isSkip(text)) return keep(s, f);
  const named = closestKinds(text)[0];
  if (named) return settle(s, f, named);
  if (s.misses + 1 < MAX_MISSES) return { ...retry(s, { key: "iv.custom_again" }), misses: s.misses + 1 };
  return keep(s, f);
}
