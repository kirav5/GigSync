import type { HiredRow } from "@gigsync/core";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { money } from "../../ui/places.js";
import { type CardProps, type OpenRow, RecordLine } from "./RecordLine.js";
import { Tag, whoOf } from "./text.js";
import "./record.css";

/**
 * Jobs the worker hired a helper for, and what they paid out: money that left, so it is never in an earnings total.
 * Each opens to the job's own card, where the household-side actions (pay, review) are. Nothing at all when the
 * worker never hired anyone.
 */
export function PaidToHelpers({
  hired,
  openId,
  onToggle,
  ...card
}: CardProps & OpenRow & { hired: readonly HiredRow[] }) {
  const { t, date } = useI18n();
  const heading = useId();
  if (hired.length === 0) return null;
  return (
    <section className="record" aria-labelledby={heading}>
      <h2 id={heading}>{t("record.hired")}</h2>
      <ul className="record-list" aria-labelledby={heading}>
        {hired.map((row) => {
          const id = row.job.engagement.id;
          const paid = row.paid_paise > 0;
          return (
            <RecordLine
              key={id}
              job={row.job}
              when={date(row.day)}
              who={whoOf(row.job, card.view.names, t("job.worker"))}
              price={row.price_paise}
              chip={{
                text: paid ? t("record.hired_paid", { price: money(row.paid_paise) }) : t("record.hired_unpaid"),
                cls: paid ? Tag.fresh : Tag.wait,
              }}
              open={openId === id}
              onToggle={() => onToggle(id)}
              {...card}
            />
          );
        })}
      </ul>
    </section>
  );
}
