import { useMemo } from "react";
import { useI18n } from "../../i18n.js";
import { Icon } from "../../ui/Icon.js";
import { requestWork } from "../../ui/work.js";
import type { GigView } from "../../useGig.js";
import { PersonRow } from "../me/PersonRow.js";
import { whoOf } from "../record/text.js";
import { type SharedEntry, sharedLog } from "./sharedEntries.js";
import "./privacy.css";

const FINE = "fine";

/** One entry: who got the owner's details and when, and whether they are still held or were removed. */
function SharedRow({ entry, names }: { entry: SharedEntry; names: GigView["names"] }) {
  const { t, date } = useI18n();
  const what = t(entry.address ? "me.shared_household" : "me.shared_worker");
  const sub = entry.at ? t("me.shared_on", { what, date: date(new Date(entry.at)) }) : what;
  const end = entry.removed ? t("me.shared_removed", { date: date(new Date(entry.removed)) }) : t("me.shared_held");
  return <PersonRow name={whoOf(entry.job, names, requestWork(t, entry.job.request))} sub={sub} end={end} />;
}

/**
 * Privacy's "What your agent shared" (design P3): a row that folds open into the log, newest first, of every job this
 * phone gave the owner's number (and a household's address) to, with when it was removed. Built from the jobs on this
 * phone; nothing is asked of GigSync.
 */
export function SharedLog({ view }: { view: GigView }) {
  const { t } = useI18n();
  const entries = useMemo(() => sharedLog(view.jobs), [view.jobs]);
  const title = t("me.shared");
  return (
    <details className="list-card shared-log">
      <summary className="list-row">
        <span className="list-row-icon">
          <Icon name="eye" size={20} />
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{title}</span>
          <span className="list-row-sub">{t("me.shared_sub")}</span>
        </span>
        <span className="list-row-chev">
          <Icon name="chev_down" size={18} />
        </span>
      </summary>
      <section className="shared-body" aria-label={title}>
        {entries.length === 0 && <p className={FINE}>{t("me.shared_none")}</p>}
        {entries.map((e) => (
          <SharedRow key={e.job.engagement.id} entry={e} names={view.names} />
        ))}
        <p className={FINE}>{t("me.shared_about")}</p>
      </section>
    </details>
  );
}
