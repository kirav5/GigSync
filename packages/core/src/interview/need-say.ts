import type { MessageKey } from "../i18n/t.js";

/** Lines the need interview says of its own accord, by what they are for. */
export const Say = {
  again: "need.again",
  againBudget: "need.again_budget",
  againYesNo: "iv.again.yes_no",
  long: "need.err_long",
  switchAsk: "need.switch_ask",
  greeting: "need.greeting",
} as const satisfies Record<string, MessageKey>;

/** The lines that mean an answer was not understood. */
export const NOT_HEARD: readonly MessageKey[] = [Say.again, Say.againBudget];
