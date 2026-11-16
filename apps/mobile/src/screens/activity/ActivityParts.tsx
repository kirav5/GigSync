import type { JobRecord, MessageKey } from "@gigsync/core";
import { type ReactNode, useId } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import type { GigView } from "../../useGig.js";
import { daysFrom, phoneDay } from "../jobGroups.js";
import { DoneRow } from "./JobRow.js";

/** How many finished jobs the Jobs tab shows under Done; Money keeps them all. */
const DONE_SHOWN = 6;
/** Finished within this many days: "This week". */
const WEEK_DAYS = 7;
/** The day before today. */
const ONE_DAY = 1;

/**
 * One section of the Jobs tab, named by its heading, with how many jobs it holds beside it. A section with nothing in
 * it is not drawn at all, so an empty page is one short line instead of three.
 */
export function Group({
  title,
  count,
  look,
  children,
}: {
  title: MessageKey;
  count: number;
  look?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  if (count === 0) return null;
  return (
    <section className={`job-group ${look ?? ""}`} aria-labelledby={id}>
      <div className="job-group-head">
        <h2 id={id} className="section-label">
          {t(title)}
        </h2>
        <span className="job-count" aria-hidden="true">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A day inside a section (Today, Coming up, Other days); nothing at all when it has no jobs. */
export function Day({ title, children }: { title: MessageKey; children: ReactNode }) {
  const { t } = useI18n();
  if (!children) return null;
  return (
    <>
      <h3 className="job-day">{t(title)}</h3>
      {children}
    </>
  );
}

/** The page with no jobs at all: what the tab is for, and what to ask in the chat. */
export function EmptyJobs({ hint }: { hint: MessageKey }) {
  const { t } = useI18n();
  return (
    <div className="jobs-empty">
      <span className="jobs-empty-icon" aria-hidden="true" />
      <p className="jobs-empty-title">{t("jobs.empty")}</p>
      <p className={C.muted}>{t(hint)}</p>
    </div>
  );
}

/** When a finished job was finished, as the heading it goes under: Today, Yesterday, This week, Earlier. */
function doneDay(today: string, job: JobRecord): MessageKey {
  const ago = -daysFrom(today, phoneDay(new Date(job.engagement.updated_at)));
  if (ago < ONE_DAY) return "schedule.today";
  if (ago === ONE_DAY) return "jobs.day.yesterday";
  return ago < WEEK_DAYS ? "jobs.day.week" : "jobs.day.earlier";
}

/**
 * The latest finished jobs under the open ones, by the day they were finished, as an order history is. Each opens
 * Money, which keeps every finished job with its payment.
 */
export function DoneGroup({
  jobs,
  view,
  today,
  onOpen,
}: {
  jobs: readonly JobRecord[];
  view: GigView;
  today: string;
  onOpen: () => void;
}) {
  const latest = [...jobs]
    .sort((a, b) => b.engagement.updated_at.localeCompare(a.engagement.updated_at))
    .slice(0, DONE_SHOWN);
  const days = new Map<MessageKey, JobRecord[]>();
  for (const job of latest) {
    const title = doneDay(today, job);
    days.set(title, [...(days.get(title) ?? []), job]);
  }
  return (
    <Group title="jobs.done" count={jobs.length}>
      {[...days].map(([title, shown]) => (
        <Day key={title} title={title}>
          <ul className="job-rows">
            {shown.map((job) => (
              <DoneRow key={job.engagement.id} job={job} view={view} onOpen={onOpen} />
            ))}
          </ul>
        </Day>
      ))}
    </Group>
  );
}

/** The way to every finished job on Money (Pay), with their count; then when the phone last checked. */
export function Foot({ closed, checked, onOpen }: { closed: number; checked: string | undefined; onOpen: () => void }) {
  const { t } = useI18n();
  const countId = useId();
  return (
    <div className="activity-foot">
      {closed > 0 && (
        <button
          type={C.button}
          className="activity-closed"
          aria-label={t("activity.tab_closed")}
          aria-describedby={countId}
          onClick={onOpen}
        >
          <span>{t("activity.tab_closed")}</span>
          <b id={countId}>{closed}</b>
          <Icon name="chev" size={18} />
        </button>
      )}
      {checked && <span className={C.faint}>{t("requests.checked", { time: checked })}</span>}
    </div>
  );
}
