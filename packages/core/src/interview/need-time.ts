import { t } from "../i18n/t.js";
import { hourText } from "../i18n/terms-text.js";
import { FIRST_HOUR, LAST_HOUR, windowAt } from "../schedule/windows.js";
import type { Choice, Prompt } from "./card.js";
import { DayWord, moveOn, type NeedState } from "./need.js";
import { hourOf, windowOf } from "./need-terms.js";
import type { NeedDraft } from "./need-types.js";

/**
 * When the worker should come, once the day is known: one chip per hour the household can start from, from
 * `FIRST_HOUR` to `LAST_HOUR` (on today, only hours still ahead), and "Any time" (ADR 0050 §1). The hour is kept as
 * the owner reads it ("2 pm", "दोपहर 2 बजे"), as a typed time is: the window the agents negotiate is read from it
 * (`windowOf`), and the worker reads the hour itself. A time said with the day ("tomorrow 10 am") skips the question.
 */

/** The time of a need whose household said any time that day is fine: asked, and nothing to read a window from. */
export const ANY_TIME = "";
/** A chip's value for an hour ("at:14"), and for any time. */
const HOUR_PICK = "at:";
export const ANY_TIME_PICK = "any_time";

const startsToday = (s: NeedState) => s.draft.day === DayWord.today || s.draft.day === s.config.today;

/**
 * The hours a household may pick: every one from the first to the last, or on today those after the phone's hour;
 * only those in the part of the day they said ("tomorrow morning"), when they said one.
 */
export function hoursOpen(s: NeedState): number[] {
  const after = startsToday(s) && s.config.hour !== undefined ? s.config.hour + 1 : FIRST_HOUR;
  const from = Math.max(FIRST_HOUR, after);
  const part = s.draft.time ? windowOf(s.draft.time) : undefined;
  return Array.from({ length: Math.max(0, LAST_HOUR - from + 1) }, (_, i) => from + i).filter(
    (h) => part === undefined || windowAt(h) === part,
  );
}

/**
 * The day is set and the household has not said the hour: the hour is asked next (ADR 0053 §1). A part of the day
 * alone ("tomorrow morning") still asks it, among that part's hours; "any time" does not.
 */
export const needsHour = (d: NeedDraft): boolean =>
  d.day !== undefined && (d.time === undefined || (d.time !== ANY_TIME && hourOf(d.time) === undefined));

/** "What time should they come?", with a chip for each hour open and "Any time" last. */
export function hourPrompt(s: NeedState): Prompt {
  const own = s.config.own;
  const choices: Choice[] = [
    ...hoursOpen(s).map((h) => ({
      value: `${HOUR_PICK}${h}`,
      key: "when.hour" as const,
      params: { time: hourText(own, h) },
    })),
    { value: ANY_TIME_PICK, key: "when.any_time" },
  ];
  return { lines: [{ key: "need.ask.hour" }], choices, hints: choices.map((c) => t(own, c.key, c.params)) };
}

/** A tapped hour, or any time: the need moves on with its time set; any other value changes nothing. */
export function chooseHour(s: NeedState, value: string): NeedState | undefined {
  if (value === ANY_TIME_PICK) return moveOn(s, { ...s.draft, time: ANY_TIME });
  const hour = value.startsWith(HOUR_PICK) ? Number(value.slice(HOUR_PICK.length)) : Number.NaN;
  if (!hoursOpen(s).includes(hour)) return undefined;
  return moveOn(s, { ...s.draft, time: hourText(s.config.own, hour) });
}
