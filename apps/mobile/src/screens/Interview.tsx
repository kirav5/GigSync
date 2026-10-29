import {
  type Card,
  CardKind,
  type Choice,
  draftOf,
  type Line,
  log,
  type MessageKey,
  type Ports,
  Slot,
} from "@gigsync/core";
import { type ReactNode, useEffect, useRef } from "react";
import type { Account } from "../adapters/account.js";
import { readAloud, stopSpeaking } from "../adapters/speech.js";
import {
  claimPublish,
  interviewFailed,
  interviewPublished,
  pauseInterview,
  Speaker,
  type Turn,
  tapInterview,
  useInterview,
} from "../card/interviewStore.js";
import { AboutPrivateError, publishCard } from "../card/publish.js";
import { type I18n, useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { errorKey } from "../ui/errorKey.js";
import { AREAS, money } from "../ui/places.js";
import { Said } from "../ui/Said.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import "./talk.css";

/** A line in the owner's language as it is now, its prices as rupees and its names (trades, area) in that language. */
function lineText(t: I18n["t"], line: Line): string {
  const prices = Object.fromEntries(Object.entries(line.prices ?? {}).map(([name, paise]) => [name, money(paise)]));
  const names = Object.fromEntries(
    Object.entries(line.names ?? {}).map(([name, keys]) => [name, keys.map((k) => t(k)).join(", ")]),
  );
  return t(line.key, { ...line.params, ...prices, ...names });
}

/** "Later": the voice stops with the questions, so a summary half read out does not carry on over the next screen. */
function later() {
  void stopSpeaking();
  pauseInterview();
}

/** What is read aloud: every line but the silent ones (the lowest rate, unless the owner just said it aloud). */
const spoken = (t: I18n["t"], lines: readonly Line[]) =>
  lines
    .filter((l) => !l.silent)
    .map((l) => lineText(t, l))
    .join(" ");

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

/** The owner's own words, on their side of the conversation. */
function Own({ text }: { text: string }) {
  return (
    <div className="msg-user">
      <div className="bubble">{text}</div>
    </div>
  );
}

/** A note to the agent and, once it has answered, its card. */
function Note({ text, card }: { text: string; card: Card | undefined }) {
  const { t, plural } = useI18n();
  return (
    <div className={C.stack}>
      <Own text={text} />
      {card && (
        <div className="msg-agent">
          <span className={C.label}>{t(KIND_LABEL[card.kind])}</span>
          <div className="text">
            <CardText card={card} />
          </div>
          {card.kind === CardKind.answer && card.sources.length > 0 && (
            <span className={C.faint}>{plural("agent.sources", card.sources.length)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** An interview question or readback, with its replay button; the silent lines are shown but never spoken. */
function Ask({ lines, children }: { lines: readonly Line[]; children?: ReactNode }) {
  const { lang, t } = useI18n();
  return (
    <div className="msg-agent iv-ask">
      <div className="iv-say">
        <div className="text">
          {lines.map((line) => (
            <p key={line.key}>{lineText(t, line)}</p>
          ))}
        </div>
        <SpeakButton lang={lang} text={spoken(t, lines)} />
      </div>
      {children}
    </div>
  );
}

/** The tap answers under the newest question, and "Later", which pauses the interview. */
function Choices({ choices }: { choices: readonly Choice[] }) {
  const { t } = useI18n();
  return (
    <div className={`${C.row} iv-choices`}>
      {choices.map((c) => (
        <button key={c.value} type={C.button} className={C.chip} onClick={() => tapInterview(c.value, t(c.key))}>
          {t(c.key)}
        </button>
      ))}
      <button type={C.button} className={`${C.chip} iv-later`} onClick={later}>
        {t("iv.later")}
      </button>
    </div>
  );
}

/**
 * Talk's conversation, in the order it happened: notes to the agent with its answers, and the card interview, each
 * question with a replay button, read aloud once when it appears, the owner's answers opposite. When the owner says
 * yes to the summary, the card is published from here.
 */
export function Interview({
  ports,
  account,
  onSaved,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
}) {
  const { lang, t } = useI18n();
  const { state, turns, paused } = useInterview();
  const active = state !== undefined && !paused;
  /** Choices are offered while a question is open, not once the owner has said yes and the card is being sent. */
  const asking = active && state.slot !== Slot.done;
  const newest = [...turns].reverse().find((turn) => turn.who === Speaker.app);
  const heard = useRef<number>(undefined);

  useEffect(() => {
    if (!active || newest?.who !== Speaker.app || heard.current === newest.id) return;
    heard.current = newest.id;
    void readAloud(lang, spoken(t, newest.lines));
  }, [active, newest, lang, t]);

  // Leaving Talk (another tab, Back) ends what is being read out.
  useEffect(
    () => () => {
      void stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    if (state?.slot !== Slot.done) return;
    const claim = claimPublish();
    if (claim === undefined) return;
    const draft = draftOf(state);
    publishCard(ports, account, draft, lang)
      .then((saved) => {
        const area = AREAS.find((a) => a.key === draft.area);
        const where = area ? { names: { area: [`area.${area.key}` as const] } } : { params: { area: "" } };
        const line: Line = { key: "iv.published", ...where };
        // Signed out while the card was on its way: the next owner hears nothing of it.
        if (!interviewPublished(claim, line)) return;
        void readAloud(lang, lineText(t, line));
        onSaved(saved);
      })
      .catch((err: unknown) => {
        log.warn("card interview publish failed", { error: err instanceof Error ? err.message : String(err) });
        // A line kept from an older card can carry a phone number; say so, so the owner knows what to change.
        interviewFailed(claim, { key: err instanceof AboutPrivateError ? "iv.err_private" : errorKey(err) });
      });
  }, [state, ports, account, lang, t, onSaved]);

  const show = (turn: Turn) => {
    if (turn.who === Speaker.owner) return <Own key={turn.id} text={turn.text} />;
    if (turn.who === Speaker.note) return <Note key={turn.id} text={turn.text} card={turn.card} />;
    return (
      <Ask key={turn.id} lines={turn.lines}>
        {asking && turn.id === newest?.id && <Choices choices={turn.choices} />}
      </Ask>
    );
  };
  // A log, so a screen reader announces each new question, readback and answer; focus stays in the composer.
  return (
    <div className="iv" role="log" aria-live="polite">
      {turns.map(show)}
    </div>
  );
}
