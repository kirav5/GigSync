import {
  type Card,
  CardKind,
  type Agent as CoreAgent,
  earningsIntent,
  edit,
  editIntent,
  log,
  movingIntent,
  type Ports,
  passbook,
  prompt,
  Slot,
  start,
} from "@gigsync/core";
import type { City } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../adapters/account.js";
import { interviewConfig } from "../card/choices.js";
import {
  addNote,
  answerInterview,
  beginInterview,
  clearTalk,
  noteAnswered,
  relanguageInterview,
  resumeInterview,
  useInterview,
} from "../card/interviewStore.js";
import { accountDraft } from "../card/publish.js";
import { useI18n } from "../i18n.js";
import { Composer, Via } from "../ui/Composer.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { money } from "../ui/places.js";
import type { GigView } from "../useGig.js";
import { Interview } from "./Interview.js";
import { NewConversation, type Suggestion, Suggestions } from "./talk/TalkStart.js";
import "./talk.css";

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview on opening Talk. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
  /** Opens the landing journey for a move to a new city, with the city Talk heard. */
  onMoving: (city?: City) => void;
  /** This phone's jobs and payments, for "what did I earn this week?". */
  view: GigView;
}

/**
 * Talk: one conversation with the worker's agent, kept across tabs: notes and its answers, on this phone (lite mode
 * without a model), and the card interview when there is no card yet or the owner asked to change it by talking.
 * Words that ask to change a field of the card ("मेरा रेट बदलो") open the interview at that field, below what was
 * said before.
 */
export function AgentScreen({ agent, ports, account, interview, onSaved, onMoving, view }: TalkProps) {
  const { lang, t } = useI18n();
  const { state, turns, paused } = useInterview();
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const active = state !== undefined && !paused;
  const current = active ? prompt(state) : undefined;
  const wanted = interview || !account.worker;

  // Opening Talk to make or change the card starts the interview; one already under way carries on where it was.
  // One paused with "Later" stays paused across tabs until the owner taps "Carry on".
  useEffect(() => {
    if (opened.current || !wanted) return;
    opened.current = true;
    if (!state) beginInterview(start(interviewConfig(lang), accountDraft(account)));
  }, [wanted, state, lang, account]);

  // A language picked in Profile part-way: the questions from here on, and what the mic listens for, follow it.
  useEffect(() => {
    if (state && state.config.own !== lang) relanguageInterview(interviewConfig(lang));
  }, [state, lang]);

  // The newest turn, or the answer that just came to a note, stays in view.
  useEffect(() => {
    if (turns.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const fresh = () => start(interviewConfig(lang), accountDraft(account));

  /** The owner's words and the answer from this phone's passbook: received this week and month, and still to come. */
  function answerEarnings(own: string) {
    const now = new Date();
    const { totals } = passbook(view.jobs, view.payments, account.session.user, now, -now.getTimezoneOffset());
    const params = { week: money(totals.week), month: money(totals.month), waiting: money(totals.waiting) };
    const card: Card = { kind: CardKind.text, say: { key: "agent.earnings", params } };
    noteAnswered(addNote(own), card);
  }

  /** Ways in for an empty Talk; changing the rate needs a card to change. */
  const suggestions: Suggestion[] = [
    ...(account.worker
      ? [
          {
            label: "agent.suggest_rate",
            run: (said: string) => beginInterview(edit(fresh(), Slot.rate), said),
          } as const,
        ]
      : []),
    { label: "agent.suggest_earned", run: answerEarnings },
  ];

  async function sendNote(own: string) {
    const field = editIntent(own);
    if (field) {
      beginInterview(account.worker ? edit(fresh(), field) : fresh(), own);
      return;
    }
    const moving = movingIntent(own, lang);
    if (moving) {
      onMoving(moving.city);
      return;
    }
    if (earningsIntent(own, lang)) {
      answerEarnings(own);
      return;
    }
    if (busy) return;
    setBusy(true);
    // Kept outside the screen: an answer that comes after the owner switched tabs still lands under its note.
    const id = addNote(own);
    try {
      noteAnswered(id, (await agent.handle(own)).card);
    } catch (err) {
      log.warn("note failed", { error: err instanceof Error ? err.message : String(err) });
      noteAnswered(id, { kind: CardKind.text, say: { key: errorKey(err) } });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Mid-interview, words go to the interview, except words that only mean moving: a newcomer often has no card yet, and
   * "I work in Bengaluru" stays an answer.
   */
  function send(text: string, via: Via) {
    if (!active) return void sendNote(text);
    const moving = movingIntent(text, lang);
    if (moving?.certain) return onMoving(moving.city);
    answerInterview(text, via === Via.voice);
  }

  return (
    <>
      <div className={C.stack}>
        <div className={`${C.row} talk-head`}>
          <span className={C.labelSq}>{t("nav.talk")}</span>
          {turns.length > 0 && <NewConversation unfinished={state !== undefined} onClear={clearTalk} />}
        </div>
        <h1 className={C.headline}>
          {t("agent.headline")} <span className={C.soft}>{t("agent.soft")}</span>
        </h1>
      </div>
      {turns.length > 0 && <Interview ports={ports} account={account} onSaved={onSaved} />}
      {paused && (
        <div className={C.row}>
          <button type={C.button} className={C.chipOn} onClick={resumeInterview}>
            {t("iv.resume")}
          </button>
        </div>
      )}
      {turns.length === 0 && !active && <Suggestions items={suggestions} />}
      <div ref={end} />
      <Dock>
        <Composer
          label={t("nav.talk")}
          placeholder={t("agent.placeholder")}
          onSend={send}
          busy={busy || state?.slot === Slot.done}
          hints={current?.hints ?? []}
          numeric={current?.numeric ?? false}
          onDeviceOnly={current?.secret ?? false}
        />
      </Dock>
    </>
  );
}
