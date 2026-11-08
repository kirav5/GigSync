import { ADD_ADDRESS, type Choice, NeedPick, NeedSlot, type NeedState } from "@gigsync/core";
import type { Arrangement } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { pickNeedDate, tapNeed, togglePick } from "../../find/needStore.js";
import { NeedSpeaker, type NeedTurn } from "../../find/needTurns.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { dayDate } from "../jobGroups.js";
import { Ask, Own } from "../talk/Bubbles.js";
import { WorkerPick } from "./WorkerPick.js";

/** A found-workers turn. */
export type FoundTurn = Extract<NeedTurn, { who: typeof NeedSpeaker.found }>;

const DATE_FIELD = "day";

/** "Pick a date": the phone's own calendar, from today on, under the When question. */
function DatePick({ chat, today }: { chat: string; today: string }) {
  const { t, date } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const day = String(new FormData(e.currentTarget).get(DATE_FIELD) ?? "");
    if (day) pickNeedDate(chat, day, date(dayDate(day)));
  }
  return (
    <form className={C.row} onSubmit={submit} aria-label={t("when.pick")}>
      <input className={C.field} type="date" name={DATE_FIELD} required min={today} aria-label={t("when.pick")} />
      <button type={C.submit} className={C.chipOn}>
        {t("need.date_ok")}
      </button>
    </form>
  );
}

/** The tap answers under the newest question. */
function Choices({
  chat,
  choices,
  today,
  onAddAddress,
  onTap,
}: {
  chat: string;
  choices: readonly Choice[];
  today: string;
  onAddAddress: () => void;
  /** Every tap, first: true when it was taken elsewhere (a kind of work outside the trades), so it goes no further. */
  onTap: (value: string, label: string) => boolean;
}) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const tap = (c: Choice) => {
    if (c.value === NeedPick.date) return setPicking(true);
    if (c.value === ADD_ADDRESS) return onAddAddress();
    if (onTap(c.value, t(c.key, c.params))) return;
    tapNeed(chat, c.value, t(c.key, c.params));
  };
  return (
    <>
      <div className={`${C.row} iv-choices`}>
        {choices.map((c) => (
          <button
            key={c.value}
            type={C.button}
            className={c.value === NeedPick.date && picking ? C.chipOn : C.chip}
            onClick={() => tap(c)}
          >
            {t(c.key, c.params)}
          </button>
        ))}
      </div>
      {picking && <DatePick chat={chat} today={today} />}
    </>
  );
}

/** The workers a search found, ticked to ask, and the button that asks them while the results are current. */
function Found({
  chat,
  turn,
  active,
  busy,
  onAsk,
  arrangement,
}: {
  chat: string;
  turn: FoundTurn;
  active: boolean;
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
  /** The arrangement asked for: each worker's rate for it is shown (ADR 0046). */
  arrangement: Arrangement | undefined;
}) {
  const { t, plural } = useI18n();
  return (
    <fieldset className={C.stack} aria-label={t("a11y.ask_workers")}>
      {turn.workers.map((w) => (
        <WorkerPick
          key={w.user}
          worker={w}
          picked={turn.picked.includes(w.user)}
          arrangement={arrangement}
          disabled={!active}
          onToggle={() => togglePick(chat, turn.id, w.user)}
        />
      ))}
      {active && (
        <button
          type={C.button}
          className={C.wide}
          disabled={busy || turn.picked.length === 0}
          aria-busy={busy}
          onClick={() => onAsk(turn)}
        >
          {plural("find.ask", turn.picked.length)}
        </button>
      )}
    </fieldset>
  );
}

/**
 * Find's conversation in the order it happened: each question with its replay button and, under the newest, its tap
 * answers; the owner's answers opposite; and what a search found, its boxes fixed once the workers were asked.
 */
export function NeedTurns({
  chat,
  state,
  turns,
  busy,
  onAsk,
  onAddAddress,
  onTap,
}: {
  /** The chat these turns are in, which every answer here names. */
  chat: string;
  state: NeedState | undefined;
  turns: readonly NeedTurn[];
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
  /** "Add an address" at the "where" question: the app opens the address form (ADR 0045). */
  onAddAddress: () => void;
  onTap: (value: string, label: string) => boolean;
}) {
  const newest = (who: NeedTurn["who"]) => [...turns].reverse().find((turn) => turn.who === who)?.id;
  const lastQuestion = newest(NeedSpeaker.app);
  const lastFound = newest(NeedSpeaker.found);
  const asking = state !== undefined && state.slot !== NeedSlot.done && state.slot !== NeedSlot.found;
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
      <Ask key={turn.id} lines={turn.lines}>
        {asking && turn.id === lastQuestion && turn.choices.length > 0 && (
          <Choices
            chat={chat}
            choices={turn.choices}
            today={state.config.today}
            onAddAddress={onAddAddress}
            onTap={onTap}
          />
        )}
      </Ask>
    );
  };
  // A log, so a screen reader announces each new question and answer; focus stays in the composer.
  return (
    <div className="iv" role="log" aria-live="polite">
      {turns.map(show)}
    </div>
  );
}
