import { type InterviewState, type MessageKey, type Prompt, Slot } from "@gigsync/core";
import type { IconName } from "../../ui/Icon.js";

/**
 * How the card chat asks each question (W1–W5): what the composer's field says while it is open, and the chip that
 * hands the answer to the composer instead of the choices.
 */

/** The field's words outside the card interview: notes to the agent, as on both owners' Home. */
const NOTE_PLACEHOLDER: MessageKey = "composer.ask";

/** The composer's placeholder for the question now asked: the work, the area, an amount, or anything else. */
export function placeholderKey(state: InterviewState | undefined, asked: Prompt | undefined): MessageKey {
  if (!state || !asked) return NOTE_PLACEHOLDER;
  // A short placeholder: the pill's field is narrow beside the mic on a 360px phone, and a longer one would be cut.
  if (state.slot === Slot.trade && !state.kind && !state.filing) return "cardflow.say_work";
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
/** The questions answered on a widget of their own, not by chips. */
const OWN_WIDGET: ReadonlySet<Slot> = new Set([Slot.radius, Slot.rate, Slot.min]);

/**
 * The chip that says "I'll answer in my own words" under the choices: Something else under the work (the eight trades
 * are not all the work there is), My own amount under a suggested amount. None where the choices are the answers.
 */
export function sayChip(state: InterviewState, asked: Prompt): SayChip | undefined {
  if (state.slot === Slot.trade && !state.kind && !state.filing) return SOMETHING_ELSE;
  // How far they go has its own: the slider under the map (RadiusAsk.tsx); the prices their cards (PriceAsk.tsx).
  if (OWN_WIDGET.has(state.slot)) return undefined;
  return asked.numeric && (asked.choices?.length ?? 0) > 0 ? OWN_AMOUNT : undefined;
}

/** At the summary with nothing to change yet: the card face shows, and the dock asks to put it on the board. */
export const readyToPublish = (state: InterviewState): boolean => state.slot === Slot.confirm && !state.changing;

/**
 * Where the turn's own answer chips stand aside: at the summary ready to publish (the dock asks), and under how far they
 * go, whose 5 and 10 km chips only set the slider (RadiusAsk.tsx), so a tap there never answers by mistake.
 */
export const ownChips = (state: InterviewState): boolean => readyToPublish(state) || state.slot === Slot.radius;
