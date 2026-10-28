import { countIn, t } from "@gigsync/core";
import { DetailFlag, EngagementStatus, type Lang, QuestionKey, Role } from "@gigsync/protocol";
import { C } from "../ui/cls.js";
import { money, TRADE_LABEL } from "../ui/places.js";
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

/**
 * A detail as "label: value" in the owner's language: known questions by their short name, yes and no as words, a
 * bare number in the digits every reader shares. Other free text shows as written until on-device translation.
 */
function detailText(lang: Lang, key: string, value: string): string {
  const q = QuestionKey.safeParse(key);
  const flag = DetailFlag.safeParse(value);
  const label = q.success ? t(lang, `detail.${q.data}`) : key;
  const shown = flag.success ? t(lang, `flag.${flag.data}`) : NUMBER_ONLY.test(value) ? String(countIn(value)) : value;
  return `${label}: ${shown}`;
}

/** One job as this owner sees it: who, what, the agents' offers, the deal, the contact, notes, the money. */
export function JobThread(props: JobActionProps) {
  const { job, view, lang } = props;
  const e = job.engagement;
  const isWorker = e.role === Role.enum.provider;
  const them = view.names[e.counterpart] || job.contact?.name || t(lang, isWorker ? "job.customer" : "job.worker");
  const terms = job.mine?.terms;
  const payments = view.payments.filter((p) => p.engagement === e.id);
  const details = Object.entries(job.request.details);
  const notes = job.notes ?? [];

  return (
    <article className={C.card} aria-label={`Job with ${them}`} data-status={e.status} lang={lang}>
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
        <span className={`${TAG[e.status]} end`}>{t(lang, `status.${e.status}`)}</span>
      </div>

      {details.length > 0 && (
        <span className={C.faint}>{details.map(([k, v]) => detailText(lang, k, v)).join(" · ")}</span>
      )}
      {isWorker && job.advice && <PlanCard advice={job.advice} lang={lang} />}
      {job.offers.length > 0 && (
        <ol className="offers" aria-label="Offers">
          {job.offers.map(({ by, offer }) => (
            <li key={offer.offer_id}>
              {by === e.role
                ? t(lang, "job.mine_offered", { price: money(offer.price_paise) })
                : t(lang, "job.theirs_offered", { name: them, price: money(offer.price_paise) })}
            </li>
          ))}
        </ol>
      )}
      {terms && (
        <fieldset aria-label="Deal">
          {t(lang, "job.signed", { price: money(terms.price_paise), slot: terms.slot })} ·{" "}
          {t(lang, job.theirs ? "job.both_signed" : "job.their_signature")}
        </fieldset>
      )}
      {job.contact && (
        <fieldset className="contact" aria-label="Contact">
          <span className={C.label}>{t(lang, "job.contact")}</span>
          <strong>{job.contact.name}</strong>
          <span>{job.contact.phone}</span>
          {job.contact.address && <span>{job.contact.address}</span>}
        </fieldset>
      )}
      {notes.length > 0 && (
        <ul className={C.stack} aria-label="Notes">
          {notes.map((n, i) => (
            // Notes have no id; the list only grows, so the position is stable.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={i} lang={n.lang}>
              <b>{n.text}</b>
              {n.lang !== lang && (
                <span className={C.faint}> · {t(lang, "job.said_in", { lang: t(lang, `lang.${n.lang}`) })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {job.cancel && <p className={C.error}>{t(lang, `cancel.${job.cancel.reason}`)}</p>}
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
