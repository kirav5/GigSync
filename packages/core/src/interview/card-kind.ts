import { type Skill, skillKey } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { type WorkMatch, workMatchName } from "../skills/suggest.js";
import { advance, type CardDraft, type InterviewState, Pick, retry } from "./card.js";
import type { Line, Prompt } from "./card-lines.js";
import { YES_NO } from "./choices.js";
import { yesNo } from "./lexicon.js";

/**
 * Said in the card interview, a worker's own words for their work get the question the card screen asks (ADR 0059):
 * "Is this TV repair?". Only a yes files them; a yes to a trade makes the work that trade, with its prices and
 * questions. Unclear twice, or a no, keeps the words as they are.
 */

const MAX_MISSES = 2;

/**
 * The work kept in the worker's words (`draft` holds it, alone or beside what the card had), and the question whether
 * it is the trade or kind of work the model named. `asked` is the skill the question is about.
 */
export const askKind = (
  s: InterviewState,
  draft: CardDraft,
  asked: Skill,
  kind: WorkMatch,
  notes: Line[],
): InterviewState => ({ ...s, draft, asking: asked, kind, notes, misses: 0, fresh: false });

export function kindPrompt(s: InterviewState): Prompt {
  const work = s.kind ? workMatchName(s.config.own, s.kind) : "";
  return {
    lines: [{ key: "skill.is_work", params: { work } }],
    choices: YES_NO,
    hints: [t(s.config.own, "flag.yes"), t(s.config.own, "flag.no")],
  };
}

/** A yes files the work; a no keeps the words; anything else asks again, then keeps them. */
export function answerKind(s: InterviewState, yes: boolean | undefined): InterviewState {
  const { kind, asking } = s;
  if (!kind || !asking) return { ...s, kind: undefined, asking: undefined };
  if (yes === undefined && s.misses + 1 < MAX_MISSES)
    return { ...retry(s, { key: "iv.again.yes_no" }), misses: s.misses + 1 };
  const at = { ...s, kind: undefined, asking: undefined };
  if (!yes) return advance(at, s.draft);
  const key = skillKey(asking.text);
  const others = (s.draft.skills ?? []).filter((sk) => skillKey(sk.text) !== key);
  if ("trade" in kind) {
    const trades = [...(s.draft.trades ?? []).filter((tr) => tr !== kind.trade), kind.trade];
    return advance(at, { ...s.draft, trades, skills: others });
  }
  return advance(at, { ...s.draft, skills: [...others, { ...asking, category: kind.category }] });
}

export const hearKind = (s: InterviewState, text: string): InterviewState => answerKind(s, yesNo(text));

export function chooseKind(s: InterviewState, value: string): InterviewState {
  if (value !== Pick.yes && value !== Pick.no) return s;
  return answerKind(s, value === Pick.yes);
}
