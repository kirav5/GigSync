import { type MessageKey, MOST_HOURS, type TermPrefs, withTerm } from "@gigsync/core";
import {
  ISO_WEEKDAYS,
  type IsoWeekday,
  MaterialsBy,
  TermKey,
  TimeWindow,
  TRADE_TERMS,
  type Trade,
} from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { WorkHoursField } from "./WorkHoursField.js";

/** Who buys the materials, as the worker picks it; "Either" leaves it unset. */
const MATERIALS: readonly { value: MaterialsBy; label: MessageKey }[] = [
  { value: MaterialsBy.enum.worker, label: "terms.card_mine" },
  { value: MaterialsBy.enum.household, label: "terms.card_theirs" },
];

/** A toggle chip. */
function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type={C.button} aria-pressed={on} className={on ? C.chipOn : C.chip} onClick={onClick}>
      {label}
    </button>
  );
}

/** One row of chips where at most one is on; the first, `none`, leaves the preference unset. */
function OneOf<V extends string | number>(p: {
  title: string;
  none: string;
  options: readonly { value: V; label: string }[];
  value: V | undefined;
  onPick: (v: V | undefined) => void;
}) {
  return (
    <>
      <span className={C.muted}>{p.title}</span>
      <div className={C.row}>
        <Chip on={p.value === undefined} label={p.none} onClick={() => p.onPick(undefined)} />
        {p.options.map((o) => (
          <Chip key={String(o.value)} on={p.value === o.value} label={o.label} onClick={() => p.onPick(o.value)} />
        ))}
      </div>
    </>
  );
}

/** A list with nothing in it is no preference: left out. */
const orNone = <T,>(list: T[]): T[] | undefined => (list.length > 0 ? list : undefined);

/**
 * A worker's own preferences for the terms besides the price (ADR 0033 §3), on their card: the hours they work, from–to
 * on the clock (ADR 0053 §1), else the parts of the day they take work (none ticked means any), the days, who buys the
 * materials, and the most hours a day for trades paid by the hour or
 * month. Kept on this phone with their rules; their agent counters a household's terms from these, never past them.
 */
export function TermPrefsField({
  trades,
  prefs,
  onChange,
}: {
  trades: readonly Trade[];
  prefs: TermPrefs;
  onChange: (next: TermPrefs) => void;
}) {
  const { t } = useI18n();
  const negotiates = (key: TermKey) => trades.some((tr) => TRADE_TERMS[tr].includes(key));
  const windows = prefs.windows ?? [];
  const clock = prefs.from !== undefined && prefs.to !== undefined;
  const toggle = (w: TimeWindow) =>
    onChange({ ...prefs, windows: windows.includes(w) ? windows.filter((x) => x !== w) : [...windows, w] });
  const days = prefs.days ?? [];
  /** A day on or off; none ticked means every day, as before. */
  const toggleDay = (d: IsoWeekday) =>
    onChange(withTerm(prefs, "days", days.includes(d) ? orNone(days.filter((x) => x !== d)) : [...days, d].sort()));

  if (trades.length === 0) return null;
  return (
    <fieldset className={C.stack} aria-label={t("terms.card")}>
      <span className={C.label}>{t("terms.card")}</span>
      <WorkHoursField prefs={prefs} onChange={onChange} />
      {/* With hours on the clock, the parts of the day are the ones those hours touch: nothing to pick. */}
      {!clock && (
        <>
          <span className={C.muted}>{t("terms.card_windows")}</span>
          <div className={C.row}>
            {TimeWindow.options.map((w) => (
              <Chip key={w} on={windows.includes(w)} label={t(`terms.window.${w}`)} onClick={() => toggle(w)} />
            ))}
          </div>
        </>
      )}
      <span className={C.muted}>{t("terms.card_days")}</span>
      <div className={C.row}>
        {ISO_WEEKDAYS.map((d) => (
          <Chip key={d} on={days.includes(d)} label={t(`day.${d}`)} onClick={() => toggleDay(d)} />
        ))}
      </div>
      <span className={C.faint}>{t("terms.card_public")}</span>
      {negotiates(TermKey.enum.materials) && (
        <OneOf
          title={t("terms.card_materials")}
          none={t("terms.card_either")}
          options={MATERIALS.map((m) => ({ value: m.value, label: t(m.label) }))}
          value={prefs.materials}
          onPick={(v) => onChange(withTerm(prefs, TermKey.enum.materials, v))}
        />
      )}
      {negotiates(TermKey.enum.hours) && (
        <OneOf
          title={t("terms.card_hours")}
          none={t("terms.card_any")}
          options={MOST_HOURS.map((h) => ({ value: h, label: String(h) }))}
          value={prefs.max_hours}
          onPick={(v) => onChange(withTerm(prefs, "max_hours", v))}
        />
      )}
    </fieldset>
  );
}
