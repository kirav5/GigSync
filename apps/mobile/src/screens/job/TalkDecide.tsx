import {
  canOffer,
  type GigDevice,
  type JobRecord,
  type TakeOver,
  TaskKind,
  type TimeAsk,
  theirLast,
  theirLatest,
} from "@gigsync/core";
import { EngagementStatus, Role, UPI_MAX_PAISE } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { jobPrice } from "../../ui/places.js";
import type { GigView } from "../../useGig.js";
import { OfferTerms } from "../terms/OfferTerms.js";
import { TimeCard } from "./TimeCard.js";

/**
 * The owner takes the talk over from their agent (ADR 0053 §3–5). After five offers each without agreement: accept
 * theirs, send an offer, or end it; the owner waiting on the other may take theirs or end it. A time the household did
 * not ask for, or one that has passed: take theirs, pick another, or end it. While the agents are still talking, the
 * owner may end the talk or take theirs at any time.
 */

const S = EngagementStatus.enum;
/** A job its agents are still talking about. */
const TALKING: ReadonlySet<EngagementStatus> = new Set([S.sent, S.clarifying, S.negotiating]);
const RUPEE = 100;

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  them: string;
}

/** The decisions about the talk itself, on a job still being talked about. */
export function TalkDecide({ job, view, device, run, them }: Props) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const task = (kind: TaskKind) => view.tasks.find((k) => k.kind === kind && k.engagement === id);
  const time = task(TaskKind.newTime);
  const takeOver = task(TaskKind.takeOver);
  if (time && job.engagement.role === Role.enum.requester)
    return <TimeCard job={job} ask={time.detail as TimeAsk} device={device} run={run} them={them} />;
  if (!TALKING.has(job.engagement.status)) return null;
  // Both agents out of offers and the other owner's turn: this one may still take their latest offer, or end it.
  const waiting = (takeOver?.detail as TakeOver | undefined)?.waiting === true;
  // A deal waiting for this owner's signature is signed or declined on its own card, not accepted again here.
  const signing = task(TaskKind.confirmDeal);
  const last = signing ? undefined : (theirLast(job) ?? (waiting ? theirLatest(job) : undefined));
  const price = last && jobPrice(lang, job.request, last.price_paise);
  return (
    <fieldset className={C.stack} aria-label={t("a11y.takeover")}>
      {takeOver && (
        <>
          <span className={C.label}>{t("decide.takeover_title")}</span>
          {price && (
            <span>
              {waiting ? t("decide.waiting_body", { name: them, price }) : t("decide.takeover_body", { price })}
            </span>
          )}
          {/* Accepting their offer accepts its terms too: say what they are. */}
          <OfferTerms terms={last?.terms} />
        </>
      )}
      {!takeOver && <span className={C.muted}>{t("talks.take_over")}</span>}
      <div className={C.actions}>
        {last && price && (
          <button type={C.button} className={C.accent} onClick={() => void run(() => device.talks.acceptTheirs(id))}>
            {t("decide.accept_theirs", { price })}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => void run(() => device.talks.end(id))}>
          {t("decide.end")}
        </button>
      </div>
      {!signing && canOffer(job) && <OwnOffer onSend={(paise) => run(() => device.talks.offer(id, paise))} />}
    </fieldset>
  );
}

/** One offer of the owner's own, in whole rupees. */
function OwnOffer({ onSend }: { onSend: (paise: number) => Promise<unknown> }) {
  const { t } = useI18n();
  const [rupees, setRupees] = useState("");
  const amount = Number.parseInt(rupees, 10);
  return (
    <div className={C.row}>
      <input
        className={C.field}
        inputMode="numeric"
        aria-label={t("decide.your_offer")}
        placeholder={t("decide.your_offer")}
        value={rupees}
        onChange={(e) => setRupees(e.target.value.replace(/\D/g, ""))}
      />
      <button
        type={C.button}
        className={C.secondary}
        disabled={!(amount > 0 && amount * RUPEE <= UPI_MAX_PAISE)}
        onClick={() => void onSend(amount * RUPEE).then(() => setRupees(""))}
      >
        {t("decide.send_offer")}
      </button>
    </div>
  );
}
