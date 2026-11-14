import type { QuestionKey } from "@gigsync/protocol";
import type { MessageKey } from "../i18n/t.js";
import type { Line } from "./card.js";
import { DayWord, firstQuestion, NeedSlot, type NeedState, workOf } from "./need.js";
import { arrangedWork } from "./need-arrangement.js";
import type { NeedDraft } from "./need-types.js";

/**
 * The interview's own reasoning, in small print over the question that follows the answer naming the work: what
 * it understood ("a cook, one visit, today") and why it asks what it asks next ("so they know how much to cook"). Built
 * only from what the phone already read, never a model's words, so it says nothing the interview did not take in, and
 * a wrong read shows before anything is sent.
 */

/**
 * A day the owner said, as the note names it. Every day stays out (monthly work has it unless another day was said, so
 * the owner may not have said it), and so does a date: the readback shows both.
 */
export const DAY_NAME: Readonly<Record<string, MessageKey>> = {
  [DayWord.today]: "when.today",
  [DayWord.tomorrow]: "when.tomorrow",
};

/** Why each detail question is asked: what the worker does with the answer. */
const WHY_DETAIL: Readonly<Partial<Record<QuestionKey, MessageKey>>> = {
  problem: "need.why.problem",
  rooms: "need.why.rooms",
  people: "need.why.people",
  route: "need.why.route",
  job: "need.why.job",
};

/** The questions the note goes over: the scope chips, the readback and the search show what was read themselves. */
const ASKING: ReadonlySet<NeedSlot> = new Set([
  NeedSlot.detail,
  NeedSlot.arrangement,
  NeedSlot.driver,
  NeedSlot.area,
  NeedSlot.when,
  NeedSlot.budget,
]);

/** Why each of the interview's own questions is asked. */
const WHY_SLOT: Readonly<Partial<Record<NeedSlot, MessageKey>>> = {
  [NeedSlot.arrangement]: "need.why.arrangement",
  [NeedSlot.driver]: "need.why.driver",
  [NeedSlot.area]: "need.why.area",
  [NeedSlot.when]: "need.why.when",
};

/** "Understood: Cook, one visit, Today." from the draft; a listed skill in its worker's own words. */
function understoodLine(d: NeedDraft): Line | undefined {
  const day = d.day === undefined ? undefined : DAY_NAME[d.day];
  const more: MessageKey[] = [
    ...(d.arrangement && arrangedWork(d) ? [`arrangement.${d.arrangement}` as const] : []),
    ...(day ? [day] : []),
  ];
  if (d.trade) return { key: "need.understood", names: { what: [`trade.${d.trade}`, ...more] }, silent: true };
  if (d.skill) return { key: "need.understood", params: { what: d.skill.text }, silent: true };
  return undefined;
}

/** Why the question now asked is asked; none for a question that says why itself (the budget) or is a readback. */
function whyKey(s: NeedState): MessageKey | undefined {
  if (s.slot !== NeedSlot.detail) return WHY_SLOT[s.slot];
  const first = firstQuestion(workOf(s.draft));
  return first ? WHY_DETAIL[first] : undefined;
}

/**
 * The small-print note, when the work was just named and a question follows, or a later answer in words filled
 * something (`need-took.ts`); empty otherwise. Never spoken: the question is what the owner answers, and the note is
 * there to read.
 */
export function understoodNote(s: NeedState): Line[] {
  if (s.switching || !ASKING.has(s.slot)) return [];
  if (!s.understood) return s.took ? [{ ...s.took, aside: true }] : [];
  const understood = understoodLine(s.draft);
  if (!understood) return [];
  const why = whyKey(s);
  return [{ ...understood, aside: true }, ...(why ? [{ key: why, silent: true, aside: true } as const] : [])];
}
