import { parseAmount } from "@gigsync/core";
import { Arrangement, mainArrangement } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { rupeesOf } from "../../ui/places.js";

/** What the worker set: the arrangements they take and the rate typed for each one besides the main. */
export interface ArrangementsValue {
  picked: Arrangement[];
  /** Rupees as typed, by arrangement. */
  typed: Partial<Record<Arrangement, string>>;
}

/**
 * The value from the card's draft: what they take, and each rate in rupees as a field holds it. With none set, monthly,
 * as every trade's card was; nothing for a card of the worker's own skills (`ownWork`), which then takes any.
 */
export const arrangementsValue = (
  picked: readonly Arrangement[] | undefined,
  rates: Partial<Record<Arrangement, number>> | undefined,
  ownWork = false,
): ArrangementsValue => ({
  picked: picked?.length ? [...picked] : ownWork ? [] : [Arrangement.enum.monthly],
  typed: Object.fromEntries(Object.entries(rates ?? {}).map(([a, paise]) => [a, rupeesOf(paise)])),
});

/** The other rates as paise; undefined when one picked has no amount (the form says so). */
export function otherRates(v: ArrangementsValue): Partial<Record<Arrangement, number>> | undefined {
  const main = mainArrangement(v.picked);
  const out: Partial<Record<Arrangement, number>> = {};
  for (const a of v.picked) {
    if (a === main) continue;
    const paise = parseAmount(v.typed[a] ?? "");
    if (paise === undefined || paise <= 0) return undefined;
    out[a] = paise;
  }
  return out;
}

/**
 * Which work a worker takes (ADR 0046), of those that fit their work (ADR 0051): hourly, one visit, weekly, monthly,
 * each a box; a rate field beside each one ticked besides the main one (the longest), whose rate is the card's usual
 * rate above.
 */
export function ArrangementsField({
  offered,
  value,
  onChange,
}: {
  offered: readonly Arrangement[];
  value: ArrangementsValue;
  onChange: (next: ArrangementsValue) => void;
}) {
  const { t } = useI18n();
  const main = mainArrangement(value.picked);
  const toggle = (a: Arrangement) => {
    const picked = value.picked.includes(a) ? value.picked.filter((x) => x !== a) : [...value.picked, a];
    onChange({ ...value, picked: offered.filter((x) => picked.includes(x)) });
  };
  return (
    <fieldset className={C.stack} aria-label={t("card.arrangements")}>
      <span className={C.label}>{t("card.arrangements")}</span>
      {offered.map((a) => (
        <div key={a} className={C.row}>
          <label className={C.checkRow}>
            <input type="checkbox" checked={value.picked.includes(a)} onChange={() => toggle(a)} />
            {t(`arrangement.${a}`)}
          </label>
          {value.picked.includes(a) && a !== main && (
            <input
              className={C.field}
              inputMode="numeric"
              aria-label={t(`card.rate.${a}`)}
              placeholder={t(`card.rate.${a}`)}
              value={value.typed[a] ?? ""}
              onChange={(e) => onChange({ ...value, typed: { ...value.typed, [a]: e.target.value } })}
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}
