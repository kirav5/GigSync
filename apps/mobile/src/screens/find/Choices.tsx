import { ADD_ADDRESS, type Choice, NeedPick } from "@gigsync/core";
import { type FormEvent, type ReactNode, useState } from "react";
import { pickNeedDate, tapNeed } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { dayDate } from "../jobGroups.js";

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

/** A tap on one of the agent's choices: the caller's look first (a kind of work outside the trades), else the chat's. */
export function tapChoice(chat: string, c: Choice, label: string, onTap: ChoicesProps["onTap"]): void {
  if (!onTap(c.value, label)) tapNeed(chat, c.value, label);
}

export interface ChoicesProps {
  chat: string;
  choices: readonly Choice[];
  today: string;
  /** "Add an address" at the "where" question: the app opens the address form (ADR 0045). */
  onAddAddress: () => void;
  /** Every tap, first: true when it was taken elsewhere (a kind of work outside the trades), so it goes no further. */
  onTap: (value: string, label: string) => boolean;
  /** Chips of the screen's own, drawn before and after the agent's in the same row. */
  lead?: ReactNode;
  tail?: ReactNode;
}

/** The tap answers under the newest question, as chips. */
export function Choices({ chat, choices, today, onAddAddress, onTap, lead, tail }: ChoicesProps) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const tap = (c: Choice) => {
    if (c.value === NeedPick.date) return setPicking(true);
    if (c.value === ADD_ADDRESS) return onAddAddress();
    tapChoice(chat, c, t(c.key, c.params), onTap);
  };
  if (choices.length === 0 && !lead && !tail) return null;
  return (
    <>
      <div className={`${C.row} iv-choices`}>
        {lead}
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
        {tail}
      </div>
      {picking && <DatePick chat={chat} today={today} />}
    </>
  );
}
