import type { JobRecord } from "@gigsync/core";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { TermsList } from "./terms/TermsList.js";

/**
 * A job refilled from the owner's record on GigSync: the price and terms as kept there, and a line saying where it
 * came from. Nothing more was ever kept there: no messages and no contact details.
 */
export function RestoredLine({ job }: { job: JobRecord }) {
  const { t } = useI18n();
  if (!job.restored) return null;
  return (
    <fieldset aria-label={t("a11y.deal")}>
      {t("contacts.restored_price", { price: money(job.restored.price_paise) })}
      <TermsList terms={job.request.terms} />
      <span className={C.faint}>{t("contacts.restored")}</span>
    </fieldset>
  );
}

/** The quiet line on a job whose contact details were removed once it was settled (ADR 0039 §3). */
export function RemovedLine({ job }: { job: JobRecord }) {
  const { t } = useI18n();
  if (!job.contacts_removed_at) return null;
  return <p className={C.faint}>{t("contacts.removed")}</p>;
}
