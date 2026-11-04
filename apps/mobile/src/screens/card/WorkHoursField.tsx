import { FIRST_HOUR, hourText, LAST_HOUR, range, type TermPrefs } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** The latest a worker's day ends: one hour after the last start hour a household can pick. */
const LAST_END = LAST_HOUR + 1;
/** The select's value for no hours of their own: any time. */
const ANY = "";

/**
 * The preferences with the worker's hours on the clock set, or both cleared (any time). The parts of the day go: with
 * hours set they are derived from them (`workHoursOf`), and cleared the worker has said any time.
 */
function withClock(prefs: TermPrefs, from?: number, to?: number): TermPrefs {
  const { from: _from, to: _to, windows: _windows, ...rest } = prefs;
  return from === undefined || to === undefined ? rest : { ...rest, from, to };
}

/** One select of hours on the clock, in the owner's words ("9 am"). */
function HourSelect(p: {
  label: string;
  hours: readonly number[];
  value: number | undefined;
  any?: string;
  onPick: (hour: number | undefined) => void;
}) {
  const { lang } = useI18n();
  return (
    <label className={C.stack}>
      <span className={C.muted}>{p.label}</span>
      <select
        className={C.field}
        aria-label={p.label}
        value={p.value === undefined ? ANY : String(p.value)}
        onChange={(e) => p.onPick(e.target.value === ANY ? undefined : Number(e.target.value))}
      >
        {p.any !== undefined && <option value={ANY}>{p.any}</option>}
        {p.hours.map((h) => (
          <option key={h} value={String(h)}>
            {hourText(lang, h)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The hours of the day a worker works, from–to on the clock (ADR 0053 §1): "Any hours" leaves both unset. Picking a
 * start keeps the end when it is still after it, else ends the day at the latest hour; the end is always after the
 * start.
 */
export function WorkHoursField({ prefs, onChange }: { prefs: TermPrefs; onChange: (next: TermPrefs) => void }) {
  const { t } = useI18n();
  const { from, to } = prefs;
  const pickFrom = (h: number | undefined) =>
    onChange(h === undefined ? withClock(prefs) : withClock(prefs, h, to !== undefined && to > h ? to : LAST_END));
  return (
    <>
      <span className={C.muted}>{t("terms.card_clock")}</span>
      <div className={C.row}>
        <HourSelect
          label={t("terms.card_from")}
          hours={range(FIRST_HOUR, LAST_HOUR)}
          value={from}
          any={t("terms.card_any_hours")}
          onPick={pickFrom}
        />
        {from !== undefined && (
          <HourSelect
            label={t("terms.card_to")}
            hours={range(from + 1, LAST_END)}
            value={to}
            onPick={(h) => onChange(withClock(prefs, from, h))}
          />
        )}
      </div>
    </>
  );
}
