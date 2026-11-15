import { ISO_WEEKDAYS, type IsoWeekday, TimeWindow } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PICKED } from "../card/AmountDial.js";

/** Monday to Friday, the quick choice beside Every day. */
const WEEKDAYS: readonly IsoWeekday[] = ISO_WEEKDAYS.slice(0, 5);

/** Whether the days picked are exactly `set`, in any order. */
const isSet = (days: readonly IsoWeekday[], set: readonly IsoWeekday[]) =>
  days.length === set.length && set.every((d) => days.includes(d));

/**
 * The days they work on the price card: a round letter for each, filled in terracotta when picked, and Every day and
 * Weekdays as the quick choices over them, lit while the days are exactly that.
 */
export function DayPick({ days, onDays }: { days: readonly IsoWeekday[]; onDays: (days: IsoWeekday[]) => void }) {
  const { t } = useI18n();
  const toggle = (d: IsoWeekday) => onDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
  const quick = [
    { key: "iv.every_day", set: ISO_WEEKDAYS },
    { key: "cardflow.weekdays", set: WEEKDAYS },
  ] as const;
  return (
    <fieldset className="price-when price-days" aria-label={t("cardflow.days")}>
      <div className="price-when-head">
        <span className="price-label">{t("cardflow.days")}</span>
        <div className="price-quick">
          {quick.map((q) => (
            <button
              key={q.key}
              type={C.button}
              aria-pressed={isSet(days, q.set)}
              className={isSet(days, q.set) ? PICKED : undefined}
              onClick={() => onDays([...q.set])}
            >
              <span>{t(q.key)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="day-dots">
        {ISO_WEEKDAYS.map((d) => (
          <button
            key={d}
            type={C.button}
            aria-pressed={days.includes(d)}
            aria-label={t(`day.${d}`)}
            className={days.includes(d) ? PICKED : undefined}
            onClick={() => toggle(d)}
          >
            <span aria-hidden="true">{t(`cardflow.day.${d}`)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The part of the day, as the kit's chips: one at most, tapped again for any part. */
export function PartPick({
  part,
  onPart,
}: {
  part: TimeWindow | undefined;
  onPart: (part: TimeWindow | undefined) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="price-when" aria-label={t("cardflow.part_of_day")}>
      <span className="price-label">{t("cardflow.part_of_day")}</span>
      <div className="price-parts">
        {TimeWindow.options.map((w) => (
          <button
            key={w}
            type={C.button}
            aria-pressed={w === part}
            className={w === part ? PICKED : undefined}
            onClick={() => onPart(w === part ? undefined : w)}
          >
            <span>{t(`cardflow.window.${w}`)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
