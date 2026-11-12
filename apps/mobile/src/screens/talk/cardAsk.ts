import { type InterviewState, type MessageKey, type Prompt, Slot } from "@gigsync/core";
import type { IconName } from "../../ui/Icon.js";

/**
 * How the card chat asks each question (W1–W5): what the composer's field says while it is open, and the chip that
 * hands the answer to the composer instead of the choices.
 */

/** The field's words outside the card interview: notes to the agent. */
const NOTE_PLACEHOLDER: MessageKey = "agent.placeholder";

/** The composer's placeholder for the question now asked: the work, the area, an amount, or anything else. */
export function placeholderKey(state: InterviewState | undefined, asked: Prompt | undefined): MessageKey {
  if (!state || !asked) return NOTE_PLACEHOLDER;
  // A short placeholder: the pill's field is narrow beside the mic on a 360px phone, and a longer one would be cut.
  if (state.slot === Slot.trade && !state.kind) return "cardflow.say_work";
  if (state.slot === Slot.area) return "cardflow.say_area";
  return asked.numeric ? "cardflow.say_number" : "cardflow.say_it";
}

/** A chip that hands the answer to the composer: its words, and its picture when it has one. */
export interface SayChip {
  key: MessageKey;
  icon?: IconName;
}

const SOMETHING_ELSE: SayChip = { key: "cardflow.something_else", icon: "plus" };
const OWN_AMOUNT: SayChip = { key: "cardflow.own_amount" };

/**
 * The chip that says "I'll answer in my own words" under the choices: Something else under the work (the eight trades
 * are not all the work there is), My own amount under a suggested amount. None where the choices are the answers.
 */
export function sayChip(state: InterviewState, asked: Prompt): SayChip | undefined {
  if (state.slot === Slot.trade && !state.kind) return SOMETHING_ELSE;
  return asked.numeric && (asked.choices?.length ?? 0) > 0 ? OWN_AMOUNT : undefined;
}

/** At the summary with nothing to change yet: the card face shows, and the dock asks to put it on the board. */
export const readyToPublish = (state: InterviewState): boolean => state.slot === Slot.confirm && !state.changing;
