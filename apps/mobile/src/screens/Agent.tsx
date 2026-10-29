import {
  type Card,
  CardKind,
  type Agent as CoreAgent,
  edit,
  editIntent,
  hireIntent,
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
  answerInterview,
  beginInterview,
  relanguageInterview,
  resumeInterview,
  useInterview,
} from "../card/interviewStore.js";
import { accountDraft } from "../card/publish.js";
import { useI18n } from "../i18n.js";
import { Composer, Via } from "../ui/Composer.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { Said } from "../ui/Said.js";
import { Interview } from "./Interview.js";
import "./talk.css";

interface Turn {
  id: number;
  own: string;
  card?: Card;
}

/** Ready notes for a gig worker's agent, in each language, matching what the on-phone router understands. */
const STARTERS: readonly MessageKey[] = ["agent.starter_1", "agent.starter_2"];

/** The heading each card kind gets on screen. */
const KIND_LABEL: Readonly<Record<Card["kind"], MessageKey>> = {
  [CardKind.text]: "card.text",
  [CardKind.saved]: "card.saved",
  [CardKind.answer]: "card.answer",
  [CardKind.draft]: "card.draft",
  [CardKind.needsModel]: "card.needs_model",
};

/** A card's words: a phrase in the owner's language, or quoted words translated on the phone when needed. */
function CardText({ card }: { card: Card }) {
  const { t } = useI18n();
  if ("say" in card) return <>{t(card.say.key, card.say.params)}</>;
  return <Said text={card.words.text} from={card.words.lang} />;
}

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview instead of the notes chat. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
  /** Opens Find to hire someone (worker to worker, flow A). */
  onHire: () => void;
}

/**
 * Talk: the card interview when there is no card yet or the owner asked to change it by talking, otherwise notes and
 * answers from the worker's agent, on this phone (lite mode without a model). Words that ask to change a field of the
 * card ("मेरा रेट बदलो") open the interview at that field.
 */
export function AgentScreen({ agent, ports, account, interview, onSaved, onHire }: TalkProps) {
  const { lang, t, plural } = useI18n();
  const { state, turns, paused } = useInterview();
  const [notes, setNotes] = useState<Turn[]>([]);
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

  useEffect(() => {
    if (turns.length + notes.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [turns.length, notes.length]);

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
    const id = Date.now();
    setNotes((n) => [...n, { id, own }]);
    try {
      const { card } = await agent.handle(own);
      setNotes((n) => n.map((x) => (x.id === id ? { ...x, card } : x)));
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
      {/* Notes and their starters, while no interview is being answered. */}
      {!active && (
        <>
          <div className={C.row}>
            {paused && (
              <button type={C.button} className={C.chipOn} onClick={resumeInterview}>
                {t("iv.resume")}
              </button>
            )}
            {notes.length === 0 && (
              <>
                <button type={C.button} className={C.chip} onClick={() => beginInterview(fresh())}>
                  {t("iv.change_card")}
                </button>
                <button type={C.button} className={C.chip} onClick={onHire}>
                  {t("hire.chip")}
                </button>
                {STARTERS.map((s) => (
                  <button key={s} type={C.button} className={C.chip} onClick={() => void sendNote(t(s))}>
                    {t(s)}
                  </button>
                ))}
              </>
            )}
          </div>
          {notes.map((turn) => (
            <div key={turn.id} className={C.stack}>
              <div className="msg-user">
                <div className="bubble">{turn.own}</div>
              </div>
              {turn.card && (
                <div className="msg-agent">
                  <span className={C.label}>{t(KIND_LABEL[turn.card.kind])}</span>
                  <div className="text">
                    <CardText card={turn.card} />
                  </div>
                  {turn.card.kind === CardKind.answer && turn.card.sources.length > 0 && (
                    <span className={C.faint}>{plural("agent.sources", turn.card.sources.length)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
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
