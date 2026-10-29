import { DetailFlag, type Lang, MaidFrequency, QuestionKey } from "@gigsync/protocol";
import { type MessageKey, pluralKey, t } from "../i18n/t.js";
import type { Choice, Prompt } from "./card.js";
import { yesNo } from "./lexicon.js";
import { firstQuestion, moveOn, type NeedDraft, type NeedState, retryNeed } from "./need.js";
import { type ScopeChip, ScopeKey } from "./scope-read.js";

/**
 * The scope chips in the need interview (ADR 0033 §5): what was read from the owner's description waits as chips,
 * right after the trade is known and before the estimate is asked. Tapping a chip removes it; "Yes, that's right"
 * confirms the rest, and only then do they become the job's details and terms.
 */

const Q = QuestionKey.enum;
/** What the scope question's taps carry: confirm, none of these, or remove one chip (`drop` then its key). */
export const ScopePick = { ok: "scope_ok", none: "scope_none", drop: "scope_drop:" } as const;
const AGAIN: MessageKey = "need.again";

/** The draft with what was read from the owner's words, to confirm, when anything was and nothing is waiting yet. */
export function withScopeRead(d: NeedDraft, chips: readonly ScopeChip[] | undefined): NeedDraft {
  if (!chips?.length || d.scope) return d;
  return { ...d, scope: { chips, confirmed: false } };
}

/** The confirmed chips that are job details, by question key: what the estimate and the workers read. */
export function scopeDetails(d: NeedDraft): Record<string, string> {
  if (!d.scope?.confirmed) return {};
  return Object.fromEntries(
    d.scope.chips.flatMap((c) => {
      const key = QuestionKey.safeParse(c.key);
      return key.success ? [[key.data, c.value]] : [];
    }),
  );
}

/** The owner confirmed "any time that day" among the chips. */
export const scopeFlexible = (d: NeedDraft): boolean =>
  Boolean(d.scope?.confirmed && d.scope.chips.some((c) => c.key === ScopeKey.flexible));

/** The chips confirmed: their details join what the owner said, filling the first question when it was open. */
function confirm(s: NeedState, chips: readonly ScopeChip[]): NeedState {
  const d: NeedDraft = { ...s.draft, scope: { chips, confirmed: true } };
  const details = scopeDetails(d);
  const seen = { ...details, ...s.draft.seen };
  const first = firstQuestion(d.trade);
  const detail = d.detail ?? (first ? seen[first] : undefined);
  return moveOn(s, { ...d, seen, detail });
}

/** One chip removed: a detail the word lists had put in from the same words goes with it. */
function drop(s: NeedState, key: string): NeedState {
  const chips = s.draft.scope?.chips ?? [];
  const left = chips.filter((c) => c.key !== key);
  const seen = Object.fromEntries(Object.entries(s.draft.seen).filter(([k]) => k !== key));
  const first = firstQuestion(s.draft.trade);
  const draft: NeedDraft = { ...s.draft, seen, ...(first === key ? { detail: undefined } : {}) };
  const next = { ...s, draft: { ...draft, scope: { chips: left, confirmed: false } } };
  return left.length === 0 ? confirm(next, left) : next;
}

/** A tap at the scope question; undefined for anything it did not offer. */
export function chooseScope(s: NeedState, value: string): NeedState | undefined {
  const chips = s.draft.scope?.chips ?? [];
  if (value === ScopePick.ok) return confirm(s, chips);
  if (value === ScopePick.none) return chips.reduce((next, c) => drop(next, c.key), s);
  if (!value.startsWith(ScopePick.drop)) return undefined;
  const key = value.slice(ScopePick.drop.length);
  return chips.some((c) => c.key === key) ? drop(s, key) : undefined;
}

/** Words at the scope question: yes confirms, no removes them all; anything else asks again. */
export function hearScope(s: NeedState, text: string): NeedState {
  const yes = yesNo(text);
  if (yes === undefined) return retryNeed(s, { key: AGAIN });
  return chooseScope(s, yes ? ScopePick.ok : ScopePick.none) ?? s;
}

/** A chip's label, in the owner's language. */
export function chipChoice(lang: Lang, chip: ScopeChip): Choice {
  const value = `${ScopePick.drop}${chip.key}`;
  const count = Number(chip.value);
  switch (chip.key) {
    case Q.rooms:
    case Q.people:
    case Q.meals:
      return { value, key: pluralKey(lang, `terms.chip.${chip.key}`, count), params: { count } };
    case Q.coats:
    case Q.hours:
      return { value, key: pluralKey(lang, `terms.${chip.key}`, count), params: { count } };
    case Q.area_sqft:
      return { value, key: "terms.chip.area_sqft", params: { count } };
    case Q.labour_only:
      return { value, key: chip.value === DetailFlag.enum.yes ? "terms.chip.labour_yes" : "terms.chip.labour_no" };
    case Q.frequency: {
      const f = MaidFrequency.safeParse(chip.value).data ?? MaidFrequency.enum.daily;
      return { value, key: `estimate.frequency.${f}` };
    }
    default:
      return { value, key: "terms.chip.flexible" };
  }
}

/** "From what you wrote, I read this": a chip per value to remove, then confirm or none. */
export function scopeQuestion(s: NeedState): Prompt {
  const own = s.config.own;
  const chips = (s.draft.scope?.chips ?? []).map((c) => chipChoice(own, c));
  return {
    lines: [{ key: "terms.scope_read" }],
    choices: [
      ...chips,
      { value: ScopePick.ok, key: "terms.scope_ok" },
      { value: ScopePick.none, key: "terms.scope_none" },
    ],
    hints: [t(own, "flag.yes"), t(own, "flag.no")],
  };
}
