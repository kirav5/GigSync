import { NeedSlot, type NeedState } from "@gigsync/core";
import { type FoundTurn, NeedSpeaker, type NeedTurn } from "../../find/needTurns.js";
import { Ask, Own } from "../talk/Bubbles.js";
import { Answers, type AnswerTools } from "./Answers.js";
import { Found } from "./Found.js";
import "./find.css";
import { ChatOpened, useOpenedAt } from "../../ui/Typed.js";

/**
 * Find's conversation in the order it happened: each question with its replay button and, under the newest, its
 * answers; the owner's answers opposite; and what a search found, its boxes fixed once the workers were asked.
 */
export function NeedTurns({
  chat,
  state,
  turns,
  busy,
  onAsk,
  onTap,
  ...tools
}: AnswerTools & {
  /** The chat these turns are in, which every answer here names. */
  chat: string;
  state: NeedState | undefined;
  turns: readonly NeedTurn[];
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
  onTap: (value: string, label: string) => boolean;
}) {
  const newest = (who: NeedTurn["who"]) => [...turns].reverse().find((turn) => turn.who === who)?.id;
  const lastQuestion = newest(NeedSpeaker.app);
  const lastFound = newest(NeedSpeaker.found);
  const asking = state !== undefined && state.slot !== NeedSlot.done && state.slot !== NeedSlot.found;
  // Another chat opened, or this one again: what is already there shows whole, only new replies write themselves out.
  const opened = useOpenedAt(chat);
  const show = (turn: NeedTurn) => {
    if (turn.who === NeedSpeaker.owner) return <Own key={turn.id} text={turn.text} />;
    if (turn.who === NeedSpeaker.found) {
      const active = state?.slot === NeedSlot.found && turn.id === lastFound;
      return (
        <Found
          key={turn.id}
          chat={chat}
          turn={turn}
          active={active}
          busy={busy}
          onAsk={onAsk}
          arrangement={state?.draft.arrangement}
        />
      );
    }
    return (
      <Ask key={turn.id} lines={turn.lines} typing={turn.id === lastQuestion}>
        {asking && turn.id === lastQuestion && (
          <Answers
            {...tools}
            chat={chat}
            state={state}
            choices={turn.choices}
            today={state.config.today}
            onTap={onTap}
          />
        )}
      </Ask>
    );
  };
  // A log, so a screen reader announces each new question and answer; focus stays in the composer.
  return (
    <ChatOpened.Provider value={opened}>
      <div className="iv" role="log" aria-live="polite">
        {turns.map(show)}
      </div>
    </ChatOpened.Provider>
  );
}
