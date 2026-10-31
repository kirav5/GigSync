import { cashPlan } from "@gigsync/core";
import type { CityGuide } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { dayAt } from "./day.js";
import { GuideText } from "./SectionView.js";

/**
 * A rough first-month total from the guide's costs and the arrival day, said to be an estimate from the draft guide,
 * each counted cost on its own line and the costs with no number listed as not known yet.
 */
export function CashPlan({ guide, arrival }: { guide: CityGuide; arrival: string }) {
  const { t, date } = useI18n();
  const plan = cashPlan(guide.costs, arrival);
  const title = t("landing.cash_title");
  const day = (d: string) => date(dayAt(d));
  return (
    <details className={C.card}>
      <summary className={C.label}>{title}</summary>
      <section className={C.stack} aria-label={title}>
        <strong className={C.money}>{t("landing.cash_total", { amount: money(plan.total_paise) })}</strong>
        <span className={C.muted}>{t("landing.cash_note", { from: day(plan.from), to: day(plan.to) })}</span>
        <ul className="guide-list">
          {plan.lines.map((line) => (
            <li key={line.cost.item}>
              <GuideText text={line.cost.item} original={false} />
              {" · "}
              {line.paise === 0
                ? t("landing.free")
                : line.times === 1
                  ? money(line.paise)
                  : t("landing.cash_times", {
                      amount: money(line.cost.amount_paise ?? 0),
                      times: line.times,
                      total: money(line.paise),
                    })}
            </li>
          ))}
          {plan.unknown.map((cost) => (
            <li key={cost.item}>
              <GuideText text={cost.item} original={false} />
              {" · "}
              {t("landing.not_known")}
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}
