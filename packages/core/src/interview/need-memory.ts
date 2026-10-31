import { DetailFlag, type Lang, type QuestionKey } from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import type { Known } from "../memory/known.js";
import type { Choice, Line } from "./card.js";
import { isMessageKey } from "./choices.js";

/**
 * What the need interview says about an answer its agent remembers from past jobs, in place of the old "same as last
 * time" chips: the agent offers it ("From your last job, rooms: 2. Use it?"), asks about an old one ("I knew this a
 * year ago… Still right?"), or says it filled one in ("I've put rooms: 2, from your last job."). Never the budget.
 */

/** A remembered answer: to the trade's first question, or the area (a key of the config's areas). */
export type Recalled = { known: Known } & ({ question: QuestionKey } | { area: string });

/** What the memory chips carry; the interview's other picks are `NeedPick` (need-hear.ts). */
export const MemoryPick = {
  /** "Yes": use the remembered answer. */
  use: "use_memory",
  /** "Change": the owner answers the question themselves. */
  own: "own_answer",
  /** "Change rooms" / "Change the area" under the next question, after the agent filled one in. */
  redoDetail: "redo_detail",
  redoArea: "redo_area",
} as const;

const Say = {
  offerDetail: "memory.offer_detail",
  oldDetail: "memory.offer_detail_old",
  filledDetail: "memory.filled_detail",
  offerArea: "memory.offer_area",
  oldArea: "memory.offer_area_old",
  filledArea: "memory.filled_area",
  changeDetail: "memory.change_detail",
  changeArea: "memory.change_area",
} as const satisfies Record<string, MessageKey>;

export const OFFER_CHOICES: readonly Choice[] = [
  { value: MemoryPick.use, key: "memory.use" },
  { value: MemoryPick.own, key: "memory.change" },
];

/** The value as a line names it: yes or no in the reader's language, else as the owner wrote it. */
function valueParts(value: string): Pick<Line, "names" | "params"> {
  const flag = DetailFlag.safeParse(value);
  return flag.success ? { names: { value: [`flag.${flag.data}`] } } : { params: { value } };
}

/** An area's name key, if the catalog of names has it. */
const areaKey = (area: string): MessageKey[] => {
  const key = `area.${area}`;
  return isMessageKey(key) ? [key] : [];
};

/** The offer (`filled` false) or the note that the agent filled it in (`filled` true). */
export function recalledLine(r: Recalled, filled: boolean): Line {
  if ("area" in r) {
    const key = filled ? Say.filledArea : r.known.fresh ? Say.offerArea : Say.oldArea;
    return { key, names: { area: areaKey(r.area) } };
  }
  const key = filled ? Say.filledDetail : r.known.fresh ? Say.offerDetail : Say.oldDetail;
  const parts = valueParts(r.known.value);
  return { key, ...parts, names: { ...parts.names, detail: [`detail.${r.question}`] } };
}

/** The chip that reopens a question the agent filled in, labelled in the owner's language. */
export function redoChoice(own: Lang, question: QuestionKey | undefined): Choice {
  if (!question) return { value: MemoryPick.redoArea, key: Say.changeArea };
  return { value: MemoryPick.redoDetail, key: Say.changeDetail, params: { detail: t(own, `detail.${question}`) } };
}
