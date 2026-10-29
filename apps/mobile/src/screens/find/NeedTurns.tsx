import { type Choice, NeedPick, NeedSlot, type NeedState } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { NeedSpeaker, type NeedTurn, pickNeedDate, tapNeed, togglePick } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { WorkerPick } from "../colleague/WorkerPick.js";
import { dayDate } from "../jobGroups.js";
import { Ask, Own } from "../talk/Bubbles.js";

/** A found-workers turn. */
export type FoundTurn = Extract<NeedTurn, { who: typeof NeedSpeaker.found }>;

const DATE_FIELD = "day";

/** "Pick a date": the phone's own calendar, from today on, under the When question. */
function DatePick({ today }: { today: string }) {
  const { t, date } = useI18n();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const day = String(new FormData(e.currentTarget).get(DATE_FIELD) ?? "");
    if (day) pickNeedDate(day, date(dayDate(day)));
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
function Choices({ choices, today }: { choices: readonly Choice[]; today: string }) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  return (
    <>
      <div className={`${C.row} iv-choices`}>
        {choices.map((c) => (
          <button
            key={c.value}
            type={C.button}
            className={c.value === NeedPick.date && picking ? C.chipOn : C.chip}
            onClick={() => (c.value === NeedPick.date ? setPicking(true) : tapNeed(c.value, t(c.key, c.params)))}
          >
            {t(c.key, c.params)}
          </button>
        ))}
      </div>
      {picking && <DatePick today={today} />}
    </>
  );
}

/** The workers a search found, ticked to ask, and the button that asks them while the results are current. */
function Found({
  turn,
  active,
  busy,
  onAsk,
}: {
  turn: FoundTurn;
  active: boolean;
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
}) {
  const { t, plural } = useI18n();
  return (
    <fieldset className={C.stack} aria-label={t("a11y.ask_workers")}>
      {turn.workers.map((w) => (
        <WorkerPick
          key={w.user}
          worker={w}
          picked={turn.picked.includes(w.user)}
          onToggle={() => togglePick(turn.id, w.user)}
        />
      ))}
      {active && (
        <button
          type={C.button}
          className={C.wide}
          disabled={busy || turn.picked.length === 0}
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
 * answers; the owner's answers opposite; and what a search found.
 */
export function NeedTurns({
  state,
  turns,
  busy,
  onAsk,
}: {
  state: NeedState | undefined;
  turns: readonly NeedTurn[];
  busy: boolean;
  onAsk: (turn: FoundTurn) => void;
}) {
  const newest = (who: NeedTurn["who"]) => [...turns].reverse().find((turn) => turn.who === who)?.id;
  const lastQuestion = newest(NeedSpeaker.app);
  const lastFound = newest(NeedSpeaker.found);
  const asking = state !== undefined && state.slot !== NeedSlot.done && state.slot !== NeedSlot.found;
  const show = (turn: NeedTurn) => {
    if (turn.who === NeedSpeaker.owner) return <Own key={turn.id} text={turn.text} />;
    if (turn.who === NeedSpeaker.found) {
      const active = state?.slot === NeedSlot.found && turn.id === lastFound;
      return <Found key={turn.id} turn={turn} active={active} busy={busy} onAsk={onAsk} />;
    }
    return (
      <Ask key={turn.id} lines={turn.lines}>
        {asking && turn.id === lastQuestion && turn.choices.length > 0 && (
          <Choices choices={turn.choices} today={state.config.today} />
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
