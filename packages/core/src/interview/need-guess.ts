import { isTradeKind, type WorkKind } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { kindKey, kindValue } from "../skills/kinds.js";
import type { Prompt } from "./card.js";
import type { NeedDraft, NeedState } from "./need.js";
import { NeedPick } from "./need-hear.js";
import type { NeedHint } from "./need-model.js";

/**
 * "Is this for…?" (ADR 0065 §7): when the phone's reader is unsure which work the words are for, and nothing else named
 * it, its likeliest kinds are offered as chips where the chat would otherwise say "Sorry" and open the list. One tap on
 * a kind goes on as if the words had named it; "Something else" opens the list. A kind is only ever offered, never
 * taken: the reader's unsure guess is wrong as often as right.
 */

/** The kinds worth offering: a need addressed to one worker offers only the trades on their card. */
export function guessesFor(s: NeedState, hint: NeedHint): readonly WorkKind[] {
  const kinds = hint.guesses ?? [];
  return s.to ? kinds.filter((k) => isTradeKind(k) && s.to?.trades.includes(k)) : kinds;
}

/**
 * The words named no work: the reader's guesses asked about, with no "Sorry" since the chat did hear something; or
 * undefined when it has none, and the question is asked again as before.
 */
export function askGuesses(s: NeedState, draft: NeedDraft, hint: NeedHint): NeedState | undefined {
  const guesses = guessesFor(s, hint);
  return guesses.length > 0 ? { ...s, draft, guesses, notes: [], fresh: false, browsing: undefined } : undefined;
}

/** The guesses as a question: each kind a chip, then "Something else". */
export function guessPrompt(s: NeedState, guesses: readonly WorkKind[]): Prompt {
  return {
    lines: [{ key: "need.guess_ask" }],
    choices: [
      ...guesses.map((k) => ({ value: kindValue(k), key: kindKey(k) })),
      // The list's own value, so "Something else" opens the list as it always does.
      { value: NeedPick.list, key: "need.guess_else" },
    ],
    hints: [...guesses.map((k) => t(s.config.own, kindKey(k))), t(s.config.own, "need.guess_else")],
  };
}
