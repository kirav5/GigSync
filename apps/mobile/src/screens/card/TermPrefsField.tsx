import type { MessageKey, TermPrefs } from "@gigsync/core";
import { MaterialsBy, TermKey, TimeWindow, TRADE_TERMS, type Trade } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** The most-hours choices a worker taps; "Any" leaves it unset. */
const HOURS = [4, 6, 8, 10] as const;
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

/** The preferences with one field set, or left out when `value` is undefined. */
function withField<K extends keyof TermPrefs>(prefs: TermPrefs, key: K, value: TermPrefs[K] | undefined): TermPrefs {
  const rest = Object.fromEntries(Object.entries(prefs).filter(([k]) => k !== key));
  return value === undefined ? rest : { ...rest, [key]: value };
}

/**
 * A worker's own preferences for the terms besides the price (ADR 0033 §3), on their card: the parts of the day they
 * take work (none ticked means any), who buys the materials, and the most hours a day for trades paid by the hour or
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
  const toggle = (w: TimeWindow) =>
    onChange({ ...prefs, windows: windows.includes(w) ? windows.filter((x) => x !== w) : [...windows, w] });

  if (trades.length === 0) return null;
  return (
    <fieldset className={C.stack} aria-label={t("terms.card")}>
      <span className={C.label}>{t("terms.card")}</span>
      <span className={C.muted}>{t("terms.card_windows")}</span>
      <div className={C.row}>
        {TimeWindow.options.map((w) => (
          <Chip key={w} on={windows.includes(w)} label={t(`terms.window.${w}`)} onClick={() => toggle(w)} />
        ))}
      </div>
      {negotiates(TermKey.enum.materials) && (
        <OneOf
          title={t("terms.card_materials")}
          none={t("terms.card_either")}
          options={MATERIALS.map((m) => ({ value: m.value, label: t(m.label) }))}
          value={prefs.materials}
          onPick={(v) => onChange(withField(prefs, TermKey.enum.materials, v))}
        />
      )}
      {negotiates(TermKey.enum.hours) && (
        <OneOf
          title={t("terms.card_hours")}
          none={t("terms.card_any")}
          options={HOURS.map((h) => ({ value: h, label: String(h) }))}
          value={prefs.max_hours}
          onPick={(v) => onChange(withField(prefs, "max_hours", v))}
        />
      )}
    </fieldset>
  );
}
