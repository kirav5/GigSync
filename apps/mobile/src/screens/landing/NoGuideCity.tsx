import { GENERAL_STEPS, NATIONAL_LINES } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { CallRows } from "../help/CallRows.js";

/**
 * A city with no guide (or "Somewhere else"): there is no journey to start, so this says so and gives what helps in any
 * city, as Talk does for such a move: the app's own checklist items in one card, and the numbers that work anywhere in
 * India as rows to call, as on Help.
 */
export function NoGuideCity() {
  const { t } = useI18n();
  const lines = NATIONAL_LINES.map((line) => {
    const name = t(`moving.line.${line.name}`);
    return { name, said: name, number: line.number };
  });
  return (
    <>
      <section className={C.card} aria-label={t("me.move_no_guide")}>
        <p className={C.muted}>{t("me.move_no_guide")}</p>
        <ul className="tick-list">
          {GENERAL_STEPS.map((step) => (
            <li key={step}>{t(`landing.fixed_${step}`)}</li>
          ))}
        </ul>
      </section>
      <CallRows label={t("landing.helplines")} lines={lines} />
    </>
  );
}
