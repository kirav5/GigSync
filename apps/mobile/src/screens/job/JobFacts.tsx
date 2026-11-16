import { dayOf, type JobRecord, noteShown, timeText } from "@gigsync/core";
import type { Lang, Payment } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { jobPrice, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { TermsList } from "../terms/TermsList.js";

/**
 * What a job has on record below the thing to do now: the deal both signed, the notes, how it ended, the money that
 * moved and the review. Each says nothing when the job has none of it.
 */

/** One side's round initial with a tick once they signed. */
function Face({ name, signed }: { name: string; signed: boolean }) {
  return (
    <span className="deal-face">
      <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
      {signed && (
        <span className="deal-tick">
          <Icon name="tick" size={12} />
        </span>
      )}
    </span>
  );
}

/**
 * The signed deal as two faces with ticks, the price large and "Fixed": the signature's hash and the rules about it
 * are under "⋯ More". Then the slot when the request had no structured day, and the terms besides the price.
 */
export function DealLine({ job, from, them }: { job: JobRecord; from: Lang | undefined; them: string }) {
  const { lang, t } = useI18n();
  const terms = job.mine?.terms;
  if (!terms) return null;
  // The signed slot is a copy of the request's `when`; with a structured day, the head says it in this phone's own
  // words, so the slot's machine-translated copy is left out. Older requests have only the slot.
  const slot = dayOf(job.request) === undefined ? terms.slot : undefined;
  const both = job.theirs !== undefined;
  return (
    <fieldset className="deal" aria-label={t("a11y.deal")}>
      <span className="deal-faces" aria-hidden="true">
        <Face name={them} signed={both} />
        <Face name={t("progress.you")} signed />
      </span>
      <strong className="deal-title">{t(both ? "job.agreed_title" : "job.their_signature")}</strong>
      <span className="deal-price">{jobPrice(lang, job.request, terms.price_paise)}</span>
      <span className={C.muted}>
        {t("job.fixed")}
        {slot && (
          <>
            {" · "}
            <Said text={slot} from={from} />
          </>
        )}
        {both && ` · ${t("job.both_signed")}`}
      </span>
      <TermsList terms={terms.terms} />
    </fieldset>
  );
}

/** The notes either side sent, with when; on the way and done are steps on the progress line, so not listed again. */
export function Notes({ job }: { job: JobRecord }) {
  const { lang, t } = useI18n();
  const notes = (job.notes ?? []).filter(noteShown);
  if (notes.length === 0) return null;
  return (
    <ul className={C.stack} aria-label={t("a11y.notes")}>
      {notes.map((n, i) => (
        // Notes have no id; the list only grows, so the position is stable.
        // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
        <li key={i} className="note">
          {n.mine && <span className={C.faint}>{t("progress.you")}: </span>}
          {n.code ? (
            <b>{t(`update.${n.code}`)}</b>
          ) : (
            <b>
              <Said text={n.text} from={n.lang} />
            </b>
          )}
          {n.at && <time dateTime={n.at}>{timeText(lang, new Date(n.at))}</time>}
        </li>
      ))}
    </ul>
  );
}

/** Why the job ended before the work did: stopped with a reason (ADR 0054), or called off. */
export function CancelLine({ job }: { job: JobRecord }) {
  const { t } = useI18n();
  if (!job.cancel) return null;
  return (
    <p className={C.error}>
      {job.cancel.stop ? t("job.stopped", { why: t(`stop.${job.cancel.stop}`) }) : t(`cancel.${job.cancel.reason}`)}
    </p>
  );
}

/** Each payment on the job, with its UPI reference once there is one. */
export function PaymentLines({ payments }: { payments: readonly Payment[] }) {
  const { t } = useI18n();
  return payments.map((p) => (
    <fieldset key={p.id} className="pay-line" aria-label={t("a11y.payment")}>
      {t("job.payment", { price: money(p.amount_paise), status: t(`pay.thread.${p.status}`) })}
      {p.utr ? ` · ${t("job.utr", { utr: p.utr })}` : ""}
    </fieldset>
  ));
}

/** The household's stars and words, as sent; the words are in the language they were written in. */
export function ReviewLine({ job, from }: { job: JobRecord; from: Lang | undefined }) {
  const { t } = useI18n();
  if (!job.review) return null;
  return (
    <fieldset aria-label={t("a11y.review")}>
      {"★".repeat(job.review.stars)} <Said text={job.review.text} from={from} />
    </fieldset>
  );
}
