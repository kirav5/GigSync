import { type Choice, draftOf, type Line, log, type Ports, Slot } from "@gigsync/core";
import { useEffect, useRef } from "react";
import type { Account } from "../adapters/account.js";
import { readAloud, stopSpeaking } from "../adapters/speech.js";
import {
  claimPublish,
  interviewFailed,
  interviewPublished,
  pauseInterview,
  Speaker,
  tapInterview,
  useInterview,
} from "../card/interviewStore.js";
import { AboutPrivateError, publishCard } from "../card/publish.js";
import { type I18n, useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AREAS, money } from "../ui/places.js";
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
 * The card interview as a conversation: each question in a bubble with a replay button, read aloud once when it
 * appears, the owner's answers opposite. When the owner says yes to the summary, the card is published from here.
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
        interviewFailed(claim, { key: err instanceof AboutPrivateError ? "iv.err_private" : "error.generic" });
      });
  }, [state, ports, account, lang, t, onSaved]);

  // A log, so a screen reader announces each new question and readback as it arrives; focus stays in the composer.
  return (
    <div className="iv" role="log" aria-live="polite">
      {turns.map((turn) =>
        turn.who === Speaker.owner ? (
          <div key={turn.id} className="msg-user">
            <div className="bubble">{turn.text}</div>
          </div>
        ) : (
          <div key={turn.id} className="msg-agent iv-ask">
            <div className="iv-say">
              <div className="text">
                {turn.lines.map((line) => (
                  <p key={line.key}>{lineText(t, line)}</p>
                ))}
              </div>
              <SpeakButton lang={lang} text={spoken(t, turn.lines)} />
            </div>
            {asking && turn.id === newest?.id && <Choices choices={turn.choices} />}
          </div>
        ),
      )}
    </div>
  );
}
