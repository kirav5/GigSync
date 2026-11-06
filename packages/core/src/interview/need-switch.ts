import type { Trade } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { Pick, type Prompt } from "./card.js";
import { YES_NO } from "./choices.js";
import { yesNo } from "./lexicon.js";
import type { NeedState } from "./need.js";
import { Say } from "./need-say.js";
import { TurnKind, type TurnRead } from "./read-turn.js";

/**
 * The owner asks about other work part-way ("my tv not working" while an AC is being booked). Nothing is thrown away on
 * a guess: the chat asks, and on a yes the new work opens in its own chat, so this one stays in the list.
 */

/** The other work the owner's words named. */
export interface WorkSwitch {
  trade?: Trade;
  jobType?: string;
  /** The words, to start the new chat with. */
  words: string;
  /** The owner said yes: the app opens the new chat. */
  accepted?: true;
}

/** The words name work that is not the need's own. */
export function namesOtherWork(s: NeedState, read: TurnRead): boolean {
  if (read.kind !== TurnKind.enum.need) return false;
  const { trade, jobType } = s.draft;
  if (read.trade) return read.trade !== trade;
  return read.jobType !== undefined && read.jobType !== jobType && trade !== undefined;
}

export const offerSwitch = (s: NeedState, read: TurnRead, words: string): NeedState => ({
  ...s,
  notes: [],
  switching: {
    ...(read.trade ? { trade: read.trade } : {}),
    ...(read.jobType ? { jobType: read.jobType } : {}),
    words,
  },
});

/** "Switch to …?" in the owner's language, the work named as a trade or in the model's words. */
export function switchPrompt(s: NeedState): Prompt {
  const to = s.switching;
  const own = s.config.own;
  const work = to?.trade ? t(own, `trade.${to.trade}`) : (to?.jobType ?? "");
  return {
    lines: [{ key: Say.switchAsk, params: { work } }],
    choices: YES_NO,
    hints: [t(own, "flag.yes"), t(own, "flag.no")],
  };
}

const decided = (s: NeedState, yes: boolean): NeedState => {
  const { switching, ...rest } = s;
  return yes && switching ? { ...s, switching: { ...switching, accepted: true } } : { ...rest, notes: [] };
};

/** A yes or no in words; anything else asks again. */
export function hearSwitch(s: NeedState, text: string): NeedState {
  const yes = yesNo(text);
  return yes === undefined ? s : decided(s, yes);
}

/** A tap on the chips. */
export const chooseSwitch = (s: NeedState, value: string): NeedState =>
  value === Pick.yes || value === Pick.no ? decided(s, value === Pick.yes) : s;
