import {
  type AddressChoice,
  askingModel,
  chooseNeed,
  chooseNeedDate,
  type FoundEstimate,
  hearNeed,
  type Line,
  MAX_ASK,
  type MessageKey,
  type NeedConfig,
  type NeedHint,
  NeedSlot,
  type NeedState,
  needEstimate,
  needPrompt,
  needWithConfig,
  needWithEstimate,
  offerSwitch,
  type PriceStep,
  searchedNeed,
  searchFailed,
  type TurnRead,
  withJobType,
  withPriceStep,
  withSkill,
} from "@gigsync/core";
import type { AddressId, BoardSkill, BoardWorker } from "@gigsync/protocol";
import { changeChat, type FindChat, movedOnFrom, type SearchClaim, settleSearch, withNeedTurns } from "./findChats.js";
import { appSaid, foundSaid, NeedSpeaker, type NeedTurn, ownerSaid } from "./needTurns.js";

/**
 * Find's conversation about one need, in the chat it belongs to (`findChats.ts`): the questions, the household's
 * answers, and the workers a search found with the ones picked. Every change names its chat, so an answer that arrives
 * after the household went to another chat (a model reading their words, a search, asking the workers) lands where it
 * was asked.
 */

/**
 * The question a state asks, as a turn; none while the found workers are on screen, or while the model thinks of the
 * next one, which shows beside the chat (FindChat) and leaves no line in it.
 */
function asked(state: NeedState): NeedTurn[] {
  if (state.slot === NeedSlot.found || askingModel(state) || state.switching?.accepted) return [];
  const p = needPrompt(state);
  return [appSaid(p.lines, p.choices ?? [])];
}

/** The chat's need moved to `next` after `said`: what was said, then the next question if the need moved on. */
function moved(chat: string, step: (state: NeedState) => NeedState, said: NeedTurn[]): void {
  changeChat(chat, (c) => {
    if (!c.need) return c;
    const next = step(c.need);
    const turns = [...c.turns, ...said, ...(next === c.need ? [] : asked(next))];
    return { ...withNeedTurns(c, turns), need: next };
  });
}

/** A new need, in a chat with nothing in it yet; a chat that has begun one already keeps it. */
export function beginNeed(chat: string, state: NeedState): void {
  changeChat(chat, (c) =>
    c.need || c.turns.length > 0 ? c : { ...withNeedTurns(c, asked(state)), need: state, to: undefined },
  );
}

/** The owner's words on screen at once, while a model reads them; `answerNeed` follows with `shown`. */
export function showOwner(chat: string, text: string): void {
  changeChat(chat, (c) => withNeedTurns(c, [...c.turns, ownerSaid(text)]));
}

/**
 * An answer in words: `aloud` when spoken (a typed budget is never read back aloud); `hint` what a model read from
 * them, already checked; `shown` when `showOwner` put the words on screen already.
 */
export function answerNeed(chat: string, text: string, aloud: boolean, hint: NeedHint = {}, shown = false): void {
  moved(chat, (state) => hearNeed(state, text, aloud, hint), shown ? [] : [ownerSaid(text)]);
}

/** An answer by tapping a choice; `label` is the choice as the owner read it. */
export function tapNeed(chat: string, value: string, label: string): void {
  moved(chat, (state) => chooseNeed(state, value), [ownerSaid(label)]);
}

/** Other work named part-way: asked about first; the owner's words go in the chat. */
export function switchNeed(chat: string, read: TurnRead, text: string): void {
  moved(chat, (state) => offerSwitch(state, read, text), [ownerSaid(text)]);
}

/** The owner said yes to the switch: this chat stays as it was, and the new work opens in its own. */
export function leaveSwitch(chat: string): void {
  changeChat(chat, (c) => {
    if (!c.need) return c;
    const { switching: _, ...need } = c.need;
    return { ...c, need };
  });
}

/** The phone's model's next price question (or that it is done), taken into the need; nothing was said. */
export function stepNeed(chat: string, step: PriceStep): void {
  moved(chat, (state) => withPriceStep(state, step), []);
}

/** A need outside the trades, named by the phone's model; the owner's words are on screen already. */
export function jobTypeNeed(chat: string, jobType: string, words: string): void {
  moved(chat, (state) => withJobType(state, jobType, words), []);
}

/** A need for a skill workers list (ADR 0047), matched on this phone; the owner's words are on screen already. */
export function skillNeed(chat: string, skill: BoardSkill, words: string, saysWhat = false): void {
  moved(chat, (state) => withSkill(state, skill, words, saysWhat), []);
}

/** A date picked on the calendar at the When question; `label` is the date as the owner reads it. */
export function pickNeedDate(chat: string, day: string, label: string): void {
  moved(chat, (state) => chooseNeedDate(state, day), [ownerSaid(label)]);
}

/** The owner changed the app's language: the questions from here on follow it; lines shown re-render by themselves. */
export function relanguageNeed(chat: string, config: NeedConfig): void {
  changeChat(chat, (c) =>
    c.need && c.need.config.own !== config.own ? { ...c, need: needWithConfig(c.need, config) } : c,
  );
}

/** The household saved a new address part-way (ADR 0045): the "where" question offers it from now on. */
export function addressesNeed(chat: string, addresses: readonly AddressChoice[]): void {
  changeChat(chat, (c) => (c.need ? { ...c, need: needWithConfig(c.need, { ...c.need.config, addresses }) } : c));
}

/** The address at the top of Find changed: a need with no place yet goes there. */
export function addressInUseNeed(chat: string, inUse: AddressId | undefined): void {
  changeChat(chat, (c) => (c.need ? { ...c, need: needWithConfig(c.need, { ...c.need.config, inUse }) } : c));
}

/** The budget question, with nothing said after it, shown again in place with the estimate that arrived. */
function withEstimateShown(c: FindChat, state: NeedState, next: NeedState): FindChat {
  const last = c.turns.at(-1);
  if (next.slot !== NeedSlot.budget || last?.who !== NeedSpeaker.app || needEstimate(next) === needEstimate(state))
    return { ...c, need: next };
  const p = needPrompt(next);
  const shown: NeedTurn = { ...last, lines: p.lines, choices: p.choices ?? [] };
  return { ...withNeedTurns(c, [...c.turns.slice(0, -1), shown]), need: next };
}

/**
 * The rate estimate for the job as described arrived (or none did). A budget question already on screen, with nothing
 * said after it, shows it in place, so the range and the suggested budget appear before the owner answers.
 */
export function needEstimateFound(chat: string, found: FoundEstimate | undefined): void {
  changeChat(chat, (c) =>
    !c.need || c.need.estimate === found ? c : withEstimateShown(c, c.need, needWithEstimate(c.need, found)),
  );
}

/** What the search found: the workers to pick from, the nearest picked, or nobody and ways to look further. */
export function needFound(claim: SearchClaim, workers: readonly BoardWorker[]): void {
  if (!settleSearch(claim)) return;
  changeChat(claim.chat, (c) => {
    if (!c.need) return c;
    const next = searchedNeed(c.need, workers.length);
    const found = workers.length
      ? [
          appSaid([{ key: "need.found" }]),
          foundSaid(
            workers,
            workers.slice(0, 1).map((w) => w.user),
          ),
        ]
      : asked(next);
    return { ...withNeedTurns(c, [...c.turns, ...found]), need: next };
  });
}

/** The search did not finish: say why, and stand at the readback so a yes searches again. */
export function needSearchFailed(claim: SearchClaim, key: MessageKey): void {
  if (settleSearch(claim)) moved(claim.chat, (state) => searchFailed(state, { key }), []);
}

/** Ticks or unticks a worker in a search's results while they can still be asked; a fourth stays unticked. */
export function togglePick(chat: string, turnId: number, user: string): void {
  changeChat(chat, (c) => {
    if (c.need?.slot !== NeedSlot.found) return c;
    const turns = c.turns.map((turn) => {
      if (turn.id !== turnId || turn.who !== NeedSpeaker.found) return turn;
      const on = turn.picked.includes(user);
      if (!on && turn.picked.length >= MAX_ASK) return turn;
      return { ...turn, picked: on ? turn.picked.filter((u) => u !== user) : [...turn.picked, user] };
    });
    return withNeedTurns(c, turns);
  });
}

/** A line from the app below the conversation: why asking failed. */
export function needSay(chat: string, line: Line): void {
  changeChat(chat, (c) => withNeedTurns(c, [...c.turns, appSaid([line])]));
}

/**
 * The workers were asked: the need is over, and its chat stays in the list as a record of what was said. Find moves on
 * to a new chat, so coming back to it starts the next need.
 */
export function needAsked(chat: string, line: Line): void {
  changeChat(chat, (c) => ({ ...withNeedTurns(c, [...c.turns, appSaid([line])]), need: undefined }));
  movedOnFrom(chat);
}
