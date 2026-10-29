import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { PayeeNudge } from "../payments/PayeeNudge.js";
import { CardState } from "../state.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import { groupJobs, phoneDay } from "./jobGroups.js";
import { MentorToday } from "./mentor/MentorToday.js";
import { JobFold, JobSection } from "./Requests.js";

interface Props {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  card: CardState;
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  onOpenCard: () => void;
  /** Opens Profile, where the UPI ID is added. */
  onAddPayee: () => void;
  /** Whose phone this is: a mentor's answer to a newcomer carries their card. */
  account: Account;
}

/**
 * The worker's home: what to decide now, then the jobs for today, coming up, and with no day; the agents' talks and
 * past jobs are folded away. Each job card carries its own actions,
 * so the screen has no dock.
 */
export function Today({ ports, view, device, run, card, onMakeCard, onOpenCard, onAddPayee, account }: Props) {
  const { t, date, time, plural } = useI18n();
  const now = ports.clock.now();
  const g = groupJobs({ jobs: view.jobs, tasks: view.tasks, payments: view.payments, day: phoneDay(now) });
  const list = { view, device, run, onAddPayee };
  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>{t("home.title", { date: date(now) })}</h1>
        {view.syncedAt && <span className={C.faint}>{t("requests.checked", { time: time(view.syncedAt) })}</span>}
      </div>
      <PayeeNudge ports={ports} view={view} onAdd={onAddPayee} />
      <MentorToday account={account} device={device} run={run} syncedAt={view.syncedAt} />
      {card === CardState.none && (
        <div className={C.card}>
          <span>{t("home.no_card")}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={onMakeCard}>
              {t("home.make_card")}
            </button>
          </div>
        </div>
      )}
      {card === CardState.off && (
        <div className={C.card}>
          <span>{t("home.card_off")}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={onOpenCard}>
              {t("nav.card")}
            </button>
          </div>
        </div>
      )}
      {view.jobs.length === 0 ? (
        <div className={C.empty}>{t("home.empty")}</div>
      ) : (
        <>
          <JobSection title={t("home.decide")} jobs={g.decide} {...list} />
          <JobSection title={t("home.today")} jobs={g.today} empty={t("home.empty_today")} {...list} />
          <JobSection title={t("home.upcoming")} jobs={g.upcoming} {...list} />
          <JobSection title={t("home.other")} jobs={g.other} {...list} />
          <JobFold summary={plural("home.talking", g.talking.length)} jobs={g.talking} {...list} />
          <JobFold summary={t("home.earlier")} jobs={g.earlier} {...list} />
        </>
      )}
      <span className={C.faint}>{t("home.passbook_hint")}</span>
    </>
  );
}
