import { countIn } from "@gigsync/core";
import { DetailFlag, EngagementStatus, QuestionKey, Role } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { Said } from "../ui/Said.js";
import { type JobActionProps, JobActions } from "./JobActions.js";
import { PlanCard } from "./JobDecide.js";

const S = EngagementStatus.enum;
const TALK = "tag talk";
const WAIT = "tag wait";
const FRESH = "tag fresh";
const DANGER = "tag danger";

/** How each status looks; its words come from the owner's language (`status.<name>`). */
const TAG: Readonly<Record<EngagementStatus, string>> = {
  [S.draft]: TALK,
  [S.sent]: TALK,
  [S.clarifying]: WAIT,
  [S.responded]: TALK,
  [S.negotiating]: TALK,
  [S.confirming]: WAIT,
  [S.agreed]: FRESH,
  [S.in_progress]: FRESH,
  [S.delivered]: FRESH,
  [S.revision]: WAIT,
  [S.closed]: FRESH,
  [S.declined]: DANGER,
  [S.expired]: DANGER,
  [S.cancelled]: DANGER,
};

/** A value that is only a number, in any script people type on Indian phones ("3", "३", "೩"). */
const NUMBER_ONLY = /^[0-9०-९೦-೯]+$/;

/** One job as this owner sees it: who, what, the agents' offers, the deal, the contact, notes, the money. */
export function JobThread(props: JobActionProps) {
  const { job, view } = props;
  const { lang, t } = useI18n();
  const e = job.engagement;
  const isWorker = e.role === Role.enum.provider;
  const them = view.names[e.counterpart] || job.contact?.name || t(isWorker ? "job.customer" : "job.worker");
  const terms = job.mine?.terms;
  const payments = view.payments.filter((p) => p.engagement === e.id);
  const details = Object.entries(job.request.details);
  const notes = job.notes ?? [];
  // The consumer's free text (need, when, typed answers, review) is in the language their request says.
  const theirs = isWorker ? job.request.lang : undefined;

  /** A detail's value: yes and no as words, a bare number in shared digits, anything else as the other side wrote it. */
  function detailValue(value: string) {
    const flag = DetailFlag.safeParse(value);
    if (flag.success) return t(`flag.${flag.data}`);
    if (NUMBER_ONLY.test(value)) return String(countIn(value));
    return <Said text={value} from={theirs} />;
  }

  return (
    <article className={C.card} aria-label={t("a11y.job_with", { name: them })} data-status={e.status} lang={lang}>
      <div className={C.row}>
        <span className="avatar" aria-hidden="true">
          {them.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{them}</strong>
          <span className={C.muted}>{t(`trade.${job.request.trade}`)}</span>
        </div>
        <span className={`${TAG[e.status]} end`}>{t(`status.${e.status}`)}</span>
      </div>
      <Said text={job.request.need} from={theirs} />
      <span className={C.muted}>
        <Said text={job.request.when} from={theirs} />
      </span>

      {details.length > 0 && (
        <ul className={`${C.faint} details`}>
          {details.map(([k, v]) => {
            const q = QuestionKey.safeParse(k);
            return (
              <li key={k}>
                {q.success ? t(`detail.${q.data}`) : k}: {detailValue(v)}
              </li>
            );
          })}
        </ul>
      )}
      {isWorker && job.advice && <PlanCard advice={job.advice} />}
      {job.offers.length > 0 && (
        <ol className="offers" aria-label={t("a11y.offers")}>
          {job.offers.map(({ by, offer }) => (
            <li key={offer.offer_id}>
              {by === e.role
                ? t("job.mine_offered", { price: money(offer.price_paise) })
                : t("job.theirs_offered", { name: them, price: money(offer.price_paise) })}
            </li>
          ))}
        </ol>
      )}
      {terms && (
        <fieldset aria-label={t("a11y.deal")}>
          {t("job.signed", { price: money(terms.price_paise), slot: terms.slot })} ·{" "}
          {t(job.theirs ? "job.both_signed" : "job.their_signature")}
        </fieldset>
      )}
      {job.contact && (
        <fieldset className="contact" aria-label={t("a11y.contact")}>
          <span className={C.label}>{t("job.contact")}</span>
          <strong>{job.contact.name}</strong>
          <span>{job.contact.phone}</span>
          {job.contact.address && <span>{job.contact.address}</span>}
        </fieldset>
      )}
      {notes.length > 0 && (
        <ul className={C.stack} aria-label={t("a11y.notes")}>
          {notes.map((n, i) => (
            // Notes have no id; the list only grows, so the position is stable.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={i}>
              {n.code ? (
                <b>{t(`update.${n.code}`)}</b>
              ) : (
                <b>
                  <Said text={n.text} from={n.lang} />
                </b>
              )}
            </li>
          ))}
        </ul>
      )}
      {job.cancel && <p className={C.error}>{t(`cancel.${job.cancel.reason}`)}</p>}
      {payments.map((p) => (
        <fieldset key={p.id} aria-label={t("a11y.payment")}>
          {t("job.payment", { price: money(p.amount_paise), status: t(`pay.thread.${p.status}`) })}
          {p.utr ? ` · ${t("job.utr", { utr: p.utr })}` : ""}
        </fieldset>
      ))}
      {job.review && (
        <fieldset aria-label={t("a11y.review")}>
          {"★".repeat(job.review.stars)} <Said text={job.review.text} from={theirs} />
        </fieldset>
      )}
      <JobActions {...props} />
    </article>
  );
}
