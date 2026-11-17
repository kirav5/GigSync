import type { GigDevice } from "@gigsync/core";
import { useMemo } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard } from "../../ui/ListRow.js";
import { requestWork } from "../../ui/work.js";
import type { GigView } from "../../useGig.js";
import { PersonRow } from "../me/PersonRow.js";
import { useMentors } from "../mentor/useMentors.js";
import { whoOf } from "../record/text.js";
import { type AlertDay, type AlertItem, AlertNext, alertFeed, byDay, dayOf } from "./feed.js";
import "./alerts.css";

/** Between what happened and when, under the name. */
const AT = " · ";
/** The group of everything before today. */
const EARLIER = "earlier";

/** What the end of a row says it needs. */
const NEXT_WORDS = { [AlertNext.confirm]: "me.alert_confirm", [AlertNext.decide]: "me.alert_needs_you" } as const;

/** One alert as a job row: who, what happened and when, and what it needs from the owner; it opens Jobs. */
function AlertRow({ alert, names, onOpen }: { alert: AlertItem; names: GigView["names"]; onOpen: () => void }) {
  const { t, time } = useI18n();
  const work = alert.job ? requestWork(t, alert.job.request) : "";
  const name = alert.name ?? (alert.job ? whoOf(alert.job, names, work) : work);
  const next = alert.next === AlertNext.none ? undefined : t(NEXT_WORDS[alert.next]);
  return (
    <PersonRow
      name={name}
      sub={t(alert.what, alert.params) + AT + time(new Date(alert.at))}
      end={next && <span className="alert-next">{next}</span>}
      onClick={onOpen}
    />
  );
}

/**
 * Two groups, as a phone's notification list keeps them: Today, and everything Earlier (each row still says its time).
 * A day's rows stay newest first.
 */
function todayAndEarlier(days: readonly AlertDay[]): AlertDay[] {
  const today = dayOf(new Date());
  const now = days.filter((d) => d.day === today);
  const before = days.filter((d) => d.day !== today).flatMap((d) => d.items);
  return before.length > 0 ? [...now, { day: EARLIER, items: before }] : now;
}

interface Props {
  view: GigView;
  device: GigDevice;
  /** Opens the Jobs tab, where every alert's job and its decision are. */
  onJobs: () => void;
}

/**
 * Alerts (design P6), from the bell on Home, Jobs and Find: what happened and what waits on the owner, a day at a time,
 * each a job row with its next action. Every row opens Jobs, where the decision is made; a worker's mentor notes are
 * there too, on Today. Built from what the phone holds (alerts/feed.ts); no welfare count, which nothing counts yet.
 */
export function Alerts({ view, device, onJobs }: Props) {
  const { t } = useI18n();
  const { intros, incoming } = useMentors(device, view.syncedAt);
  const days = useMemo(
    () =>
      todayAndEarlier(
        byDay(
          alertFeed({
            jobs: view.jobs,
            tasks: view.tasks,
            offers: view.offers,
            intros,
            incoming,
            cityName: (city) => t(`mentor.city.${city}`),
          }),
        ),
      ),
    [view.jobs, view.tasks, view.offers, intros, incoming, t],
  );
  if (days.length === 0) return <p className={C.empty}>{t("tabs.alerts_none")}</p>;
  return days.map((day) => (
    <ListCard key={day.day} label={t(day.day === EARLIER ? "chats.earlier" : "chats.today")}>
      {day.items.map((a) => (
        <AlertRow key={a.id} alert={a} names={view.names} onOpen={onJobs} />
      ))}
    </ListCard>
  ));
}
