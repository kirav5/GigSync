import type { GigDevice, JobRecord, Ports } from "@gigsync/core";
import { Role } from "@gigsync/protocol";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { PayeeNudge } from "../payments/PayeeNudge.js";
import { CardState } from "../state.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import { linkedOnly, useColleagues } from "./colleague/context.js";
import { groupJobs, phoneDay, referralsOpen } from "./jobGroups.js";
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

const isHire = (job: JobRecord) => job.engagement.role === Role.enum.requester;

/**
 * The worker's home: what to decide now (a request they turned down they may pass on to a colleague), then the jobs
 * for today, coming up, and with no day, then the helpers they hired; the agents' talks and past jobs are folded away.
 * Each job card carries its own actions, so the screen has no dock.
 */
export function Today({ ports, view, device, run, card, onMakeCard, onOpenCard, onAddPayee, account }: Props) {
  const { t, date, time, plural } = useI18n();
  const { colleagues, answers } = useColleagues();
  const now = ports.clock.now();
  const canSuggest = linkedOnly(colleagues).length > 0;
  const referrals = referralsOpen({ jobs: view.jobs, answered: answers, canSuggest, now });
  const filing = { tasks: view.tasks, payments: view.payments, day: phoneDay(now), referrals };
  const g = groupJobs({ jobs: view.jobs.filter((j) => !isHire(j)), ...filing });
  // Jobs this worker asked someone else to do: the household's side (pay, review), in a section of their own.
  const h = groupJobs({ jobs: view.jobs.filter(isHire), ...filing });
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
          <JobSection
            title={t("hire.section")}
            jobs={[...h.decide, ...h.today, ...h.upcoming, ...h.other, ...h.talking]}
            {...list}
          />
          <JobFold summary={plural("home.talking", g.talking.length)} jobs={g.talking} {...list} />
          <JobFold summary={t("home.earlier")} jobs={[...g.earlier, ...h.earlier]} {...list} />
        </>
      )}
      <span className={C.faint}>{t("home.passbook_hint")}</span>
    </>
  );
}
