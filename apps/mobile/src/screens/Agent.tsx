import {
  CardKind,
  type Agent as CoreAgent,
  edit,
  editIntent,
  hireIntent,
  log,
  type MessageKey,
  type Ports,
  prompt,
  Slot,
  start,
} from "@gigsync/core";
import { useEffect, useRef, useState } from "react";
import type { Account } from "../adapters/account.js";
import { interviewConfig } from "../card/choices.js";
import {
  addNote,
  answerInterview,
  beginInterview,
  noteAnswered,
  relanguageInterview,
  resumeInterview,
  Speaker,
  useInterview,
} from "../card/interviewStore.js";
import { accountDraft } from "../card/publish.js";
import { useI18n } from "../i18n.js";
import { Composer, Via } from "../ui/Composer.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { Interview } from "./Interview.js";
import "./talk.css";

/** Ready notes for a gig worker's agent, in each language, matching what the on-phone router understands. */
const STARTERS: readonly MessageKey[] = ["agent.starter_1", "agent.starter_2"];

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview on opening Talk. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
  /** Opens Find to hire someone (worker to worker, flow A). */
  onHire: () => void;
}

/**
 * Talk: one conversation with the worker's agent, kept across tabs: notes and its answers, on this phone (lite mode
 * without a model), and the card interview when there is no card yet or the owner asked to change it by talking.
 * Words that ask to change a field of the card ("मेरा रेट बदलो") open the interview at that field, below what was
 * said before.
 */
export function AgentScreen({ agent, ports, account, interview, onSaved, onHire }: TalkProps) {
  const { lang, t } = useI18n();
  const { state, turns, paused } = useInterview();
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const active = state !== undefined && !paused;
  const current = active ? prompt(state) : undefined;
  const wanted = interview || !account.worker;
  const noted = turns.some((turn) => turn.who === Speaker.note);

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

  async function sendNote(own: string) {
    const field = editIntent(own);
    if (field) {
      beginInterview(account.worker ? edit(fresh(), field) : fresh(), own);
      return;
    }
    if (hireIntent(own, lang)) {
      onHire();
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

  const send = (text: string, via: Via) => (active ? answerInterview(text, via === Via.voice) : void sendNote(text));

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.talk")}</span>
        <h1 className={C.headline}>
          {t("agent.headline")} <span className={C.soft}>{t("agent.soft")}</span>
        </h1>
      </div>
      {turns.length > 0 && <Interview ports={ports} account={account} onSaved={onSaved} />}
      {/* What the owner can start while no interview is being answered; the ready notes only before the first. */}
      {!active && (
        <div className={C.row}>
          {paused && (
            <button type={C.button} className={C.chipOn} onClick={resumeInterview}>
              {t("iv.resume")}
            </button>
          )}
          <button type={C.button} className={C.chip} onClick={() => beginInterview(fresh())}>
            {t("iv.change_card")}
          </button>
          <button type={C.button} className={C.chip} onClick={onHire}>
            {t("hire.chip")}
          </button>
          {!noted &&
            STARTERS.map((s) => (
              <button key={s} type={C.button} className={C.chip} onClick={() => void sendNote(t(s))}>
                {t(s)}
              </button>
            ))}
        </div>
      )}
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
