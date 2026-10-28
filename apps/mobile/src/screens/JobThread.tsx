import { t } from "@gigsync/core";
import { CancelReason, DEFAULT_LANG, EngagementStatus, QuestionKey, Role } from "@gigsync/protocol";
import { C } from "../ui/cls.js";
import { money, TRADE_LABEL } from "../ui/places.js";
import { type JobActionProps, JobActions } from "./JobActions.js";

const S = EngagementStatus.enum;
const TALK = "tag talk";
const WAIT = "tag wait";
const FRESH = "tag fresh";
const DANGER = "tag danger";

/** A detail's label in the owner's language when it answers a known question, else its own name. */
const detailLabel = (key: string) => {
  const q = QuestionKey.safeParse(key);
  // TODO(G1): the owner's language from settings.
  return q.success ? t(DEFAULT_LANG, `detail.${q.data}`) : key;
};

const STATUS: Readonly<Record<EngagementStatus, { text: string; cls: string }>> = {
  [S.draft]: { text: "Sending", cls: TALK },
  [S.sent]: { text: "Asked", cls: TALK },
  [S.clarifying]: { text: "Question asked", cls: WAIT },
  [S.responded]: { text: "Answered", cls: TALK },
  [S.negotiating]: { text: "Agents negotiating", cls: TALK },
  [S.confirming]: { text: "Waiting for a signature", cls: WAIT },
  [S.agreed]: { text: "Agreed", cls: FRESH },
  [S.in_progress]: { text: "On the way", cls: FRESH },
  [S.delivered]: { text: "Done", cls: FRESH },
  [S.revision]: { text: "Fixing", cls: WAIT },
  [S.closed]: { text: "Closed", cls: FRESH },
  [S.declined]: { text: "Declined", cls: DANGER },
  [S.expired]: { text: "Expired", cls: DANGER },
  [S.cancelled]: { text: "Cancelled", cls: DANGER },
};

const CR = CancelReason.enum;
const REASON: Readonly<Record<CancelReason, string>> = {
  [CR.no_match]: "Does not take this kind of job, or this area",
  [CR.no_deal]: "No price inside both limits",
  [CR.declined_by_owner]: "Turned down the deal",
  [CR.taken]: "Booked with another worker",
  [CR.other]: "Cancelled",
};

/** One job as this owner sees it: who, what, the agents' offers, the deal, the contact, the money. */
export function JobThread(props: JobActionProps) {
  const { job, view } = props;
  const e = job.engagement;
  const isWorker = e.role === Role.enum.provider;
  const them = view.names[e.counterpart] || job.contact?.name || (isWorker ? "Customer" : "Worker");
  const tag = STATUS[e.status];
  const terms = job.mine?.terms;
  const payments = view.payments.filter((p) => p.engagement === e.id);

  return (
    <article className={C.card} aria-label={`Job with ${them}`} data-status={e.status}>
      <div className={C.row}>
        <span className="avatar" aria-hidden="true">
          {them.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{them}</strong>
          <span className={C.muted}>
            {TRADE_LABEL[job.request.trade]} · {job.request.need} · {job.request.when}
          </span>
        </div>
        <span className={`${tag.cls} end`}>{tag.text}</span>
      </div>

      {Object.keys(job.request.details).length > 0 && (
        <span className={C.faint}>
          {Object.entries(job.request.details)
            .map(([k, v]) => `${detailLabel(k)}: ${v}`)
            .join(" · ")}
        </span>
      )}
      {job.offers.length > 0 && (
        <ol className="offers" aria-label="Offers">
          {job.offers.map(({ by, offer }) => (
            <li key={offer.offer_id}>
              {by === e.role ? "Your agent" : `${them}'s agent`} offered <b>{money(offer.price_paise)}</b>
            </li>
          ))}
        </ol>
      )}
      {terms && (
        <fieldset aria-label="Deal">
          Signed: <b>{money(terms.price_paise)}</b> · {terms.slot}
          {job.theirs ? " · both signed" : " · waiting for their signature"}
        </fieldset>
      )}
      {job.contact && (
        <fieldset className="contact" aria-label="Contact">
          <span className={C.label}>Contact, released after both signed</span>
          <strong>{job.contact.name}</strong>
          <span>{job.contact.phone}</span>
          {job.contact.address && <span>{job.contact.address}</span>}
        </fieldset>
      )}
      {job.cancel && <p className={C.error}>{REASON[job.cancel.reason]}</p>}
      {payments.map((p) => (
        <fieldset key={p.id} aria-label="Payment">
          Payment {money(p.amount_paise)}: <b>{p.status}</b>
          {p.utr ? ` · UPI ref ${p.utr}` : ""}
        </fieldset>
      ))}
      {job.review && (
        <fieldset aria-label="Review">
          {"★".repeat(job.review.stars)} {job.review.text}
        </fieldset>
      )}
      <JobActions {...props} />
    </article>
  );
}
