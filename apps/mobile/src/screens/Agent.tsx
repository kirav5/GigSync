import {
  type Agent as CoreAgent,
  edit,
  type GigDevice,
  isLastSlot,
  movingIntent,
  type Ports,
  prompt,
  Slot,
  start,
} from "@gigsync/core";
import type { City } from "@gigsync/protocol";
import { useEffect, useRef } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { interviewConfig } from "../card/choices.js";
import {
  addNote,
  answerInterview,
  beginInterview,
  pauseInterview,
  relanguageInterview,
  resumeInterview,
} from "../card/interviewStore.js";
import { accountDraft } from "../card/publish.js";
import { useI18n } from "../i18n.js";
import { openChat, useTalk } from "../talk/talkStore.js";
import { useMoves } from "../talk/useMoves.js";
import { useNotes } from "../talk/useNotes.js";
import { Composer, Via } from "../ui/Composer.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import type { GigView } from "../useGig.js";
import { Interview } from "./Interview.js";
import { ModelNotice } from "./model/ModelNotice.js";
import { Thinking } from "./talk/NoteView.js";
import { type Suggestion, Suggestions } from "./talk/TalkStart.js";
import "./talk.css";

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview on opening Talk. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
  /** Opens the moving checklist (the landing journey) for the city of the move Talk is about. */
  onChecklist: (city: City) => void;
  /** Opens Find a mentor, the fallback with introductions, when nobody in the chat's search matches. */
  onFindMentor: () => void;
  /** This phone's jobs and payments, for "what did I earn this week?". */
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * Talk: chats with the worker's agent, kept on this phone: notes and its answers (lite mode without a model), and the
 * card interview when there is no card yet or the owner asked to change it by talking. Words that ask to change a
 * field of the card ("मेरा रेट बदलो") open the interview at that field, below what was said before. Moving to a new
 * city, offering to help newcomers and the guide's answers are all in the chat (`talk/useMoves.ts`): no menu to find.
 * Past chats and "New chat" are in the menu (shell/DrawerChats.tsx), as in the collab app.
 */
export function AgentScreen(props: TalkProps) {
  const { agent, ports, account, interview, onSaved, onChecklist, onFindMentor, view, device, run } = props;
  const i18n = useI18n();
  const { lang, t } = i18n;
  const { ready, open, state, turns, paused, interviewIn } = useTalk();
  const moves = useMoves({ ports, account, device, run, lang }, { onChecklist, onMoreWays: onFindMentor });
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const active = state !== undefined && !paused;
  const current = active ? prompt(state) : undefined;
  const wanted = interview || !account.worker;

  // Opening Talk to make or change the card starts the interview; one already under way carries on where it was, in
  // the chat it belongs to. One paused ("Later", or left for another chat) stays paused until the owner taps "Carry on".
  useEffect(() => {
    if (opened.current || !wanted || !ready) return;
    opened.current = true;
    if (!interviewIn) beginInterview(start(interviewConfig(lang), accountDraft(account), account.listed === false));
    else if (interviewIn !== open) openChat(interviewIn);
  }, [wanted, ready, interviewIn, open, lang, account]);

  // A language picked in About me part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang) relanguageInterview(interviewConfig(lang));
  }, [state, lang]);

  // The newest turn, or the answer that just came to a note, stays in view.
  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const fresh = () => start(interviewConfig(lang), accountDraft(account), account.listed === false);
  const { busy, sendNote, choose, answerEarnings } = useNotes({
    agent,
    ports,
    account,
    view,
    i18n,
    turns,
    moves,
    fresh,
  });

  const isWorker = account.role === AccountRole.worker;
  /** Ways in for an empty Talk, at most three; changing the rate needs a card, a move is for a worker. */
  const suggestions: Suggestion[] = [
    ...(account.worker
      ? [
          {
            label: "agent.suggest_rate",
            run: (said: string) => beginInterview(edit(fresh(), Slot.rate), said),
          } as const,
        ]
      : []),
    { label: "agent.suggest_earned", run: (said: string) => answerEarnings(addNote(said)) },
    ...(isWorker ? [{ label: "moving.suggest", run: (said: string) => moves.start(said, undefined) } as const] : []),
  ];

  /**
   * Mid-interview, words go to the interview, except words that only mean moving: a newcomer often has no card yet, so
   * the interview waits for "Carry on" and the move is answered; "I work in Bengaluru" stays an answer.
   */
  function send(text: string, via: Via) {
    if (!active) return void sendNote(text);
    const moving = movingIntent(text, lang);
    if (!moving?.certain) return answerInterview(text, via === Via.voice);
    pauseInterview();
    moves.start(text, moving.city);
  }

  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>
          {t("agent.headline")} <span className={C.soft}>{t("agent.soft")}</span>
        </h1>
      </div>
      <ModelNotice />
      {turns.length > 0 && (
        <Interview
          ports={ports}
          account={account}
          onSaved={onSaved}
          moves={moves}
          thinking={busy}
          onChoose={(asked, intent) => void choose(asked, intent)}
        />
      )}
      {(moves.busy || (active && state.slot === Slot.done)) && <Thinking />}
      {paused && (
        <div className={C.row}>
          <button type={C.button} className={C.chipOn} onClick={resumeInterview}>
            {t("iv.resume")}
          </button>
        </div>
      )}
      {ready && turns.length === 0 && !active && <Suggestions items={suggestions} />}
      <div ref={end} />
      <Dock>
        <Composer
          label={t("nav.talk")}
          placeholder={t("agent.placeholder")}
          onSend={send}
          busy={busy || moves.busy || !ready || (state !== undefined && isLastSlot(state.slot))}
          hints={current?.hints ?? []}
          numeric={current?.numeric ?? false}
          onDeviceOnly={current?.secret ?? false}
        />
      </Dock>
    </>
  );
}
