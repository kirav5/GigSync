import { type Card, CardKind, type ChatIntent, type ChatLine, ChatSide, RECENT_LINES } from "@gigsync/core";
import type { I18n } from "../i18n.js";
import { lineText } from "../screens/talk/Bubbles.js";
import { isMoveTurn } from "./moveTurns.js";
import { Speaker, type Turn } from "./turns.js";

/**
 * What the phone's language model reads a new message against in Talk (ADR 0042 amendment 2026-11-03): the chat's
 * last few lines, the owner's words and the agent's answers as the owner saw them, oldest first. It stays on the
 * phone, as the message does. A move's own turns are left out: its chat has its own guide.
 */

type Words = Pick<I18n, "t" | "date">;

/** A card's words as the owner reads them. */
export const cardText = ({ t }: Words, card: Card): string =>
  "say" in card ? t(card.say.key, card.say.params) : card.words.text;

function linesOf(i18n: Words, turn: Turn): ChatLine[] {
  if (isMoveTurn(turn)) return [];
  switch (turn.who) {
    case Speaker.owner:
      return [{ side: ChatSide.owner, text: turn.text }];
    case Speaker.note:
      return [
        { side: ChatSide.owner, text: turn.text },
        ...(turn.card ? [{ side: ChatSide.agent, text: cardText(i18n, turn.card) }] : []),
      ];
    case Speaker.app:
      return [{ side: ChatSide.agent, text: turn.lines.map((line) => lineText(i18n, line)).join(" ") }];
  }
}

/** The chat so far, at most RECENT_LINES lines. */
export const chatSoFar = (i18n: Words, turns: readonly Turn[]): ChatLine[] =>
  turns
    .slice(-RECENT_LINES)
    .flatMap((turn) => linesOf(i18n, turn))
    .slice(-RECENT_LINES);

/** The agent's question the owner has not answered yet: the newest turn, a note whose card asks which they meant. */
export interface OpenQuestion {
  id: number;
  text: string;
  choices: readonly ChatIntent[];
}

export function openQuestion(turns: readonly Turn[]): OpenQuestion | undefined {
  const last = turns.at(-1);
  if (!last || isMoveTurn(last) || last.who !== Speaker.note || last.card?.kind !== CardKind.clarify) return undefined;
  return { id: last.id, text: last.text, choices: last.card.choices };
}
