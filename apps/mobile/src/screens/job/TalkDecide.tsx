import {
  AGENT_OFFERS,
  canOffer,
  type GigDevice,
  type JobRecord,
  type TakeOver as TakeOverDetail,
  TaskKind,
  theirLast,
  theirLatest,
} from "@gigsync/core";
import { Role } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import type { Step } from "../../payments/useStep.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { jobPrice, money } from "../../ui/places.js";
import type { GigView } from "../../useGig.js";
import { OfferTerms } from "../terms/OfferTerms.js";
import { J } from "./look.js";
import { OwnOffer } from "./OwnOffer.js";

/**
 * The owner takes the talk over from their agent (ADR 0053 §3–5). After five offers each without agreement it is
 * theirs to decide at once: accept the other side's offer, send one of their own, or end it; the owner waiting on the
 * other may take theirs or end it. While the agents are still talking, the owner may step in at any turn.
 */

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  step: Step;
  them: string;
}

/** The other side's offer this owner may accept now, unless a deal already waits for their signature. */
function theirsNow(job: JobRecord, view: GigView, waiting: boolean) {
  const id = job.engagement.id;
  const signing = view.tasks.some((k) => k.kind === TaskKind.confirmDeal && k.engagement === id);
  const last = signing ? undefined : (theirLast(job) ?? (waiting ? theirLatest(job) : undefined));
  return { signing, last };
}

/** The accept, own offer and end controls, the same whether the agents are stuck or the owner stepped in. */
function Controls({ job, view, device, step, waiting }: Props & { waiting: boolean }) {
  const { lang, t } = useI18n();
  const id = job.engagement.id;
  const { signing, last } = theirsNow(job, view, waiting);
  return (
    <>
      {last && (
        <button type={C.button} className={J.hero} onClick={() => step(() => device.talks.acceptTheirs(id))}>
          <Icon name="tick" />
          {t("decide.accept_theirs", { price: jobPrice(lang, job.request, last.price_paise) })}
        </button>
      )}
      {!signing && canOffer(job) && (
        <OwnOffer onSend={(paise, sent) => step(() => device.talks.offer(id, paise), sent)} />
      )}
      <button type={C.button} className={J.ghost} onClick={() => step(() => device.talks.end(id))}>
        {t("decide.end")}
      </button>
    </>
  );
}

/**
 * The agents used their offers (H8): a dark card says what the other side asks and, on this phone only, this owner's
 * own limit; then accept, one last offer, or end. The controls show at once: the decision is the owner's now.
 */
export function StuckCard(props: Props & { detail: TakeOverDetail | undefined }) {
  const { job, them, detail } = props;
  const { lang, t } = useI18n();
  const waiting = detail?.waiting === true;
  const { last } = theirsNow(job, props.view, waiting);
  const price = last && jobPrice(lang, job.request, last.price_paise);
  const limit = job.mandate && jobPrice(lang, job.request, job.mandate.limit_paise);
  const isWorker = job.engagement.role === Role.enum.provider;
  return (
    <fieldset className={C.stack} aria-label={t("a11y.takeover")}>
      <div className={J.amount}>
        <span className={C.muted}>{t("decide.takeover_title")}</span>
        {price && waiting && <p className={J.heroLine}>{t("decide.waiting_body", { name: them, price })}</p>}
        {price && !waiting && (
          <p className={J.heroLine}>
            {t(isWorker ? "jobcard.they_offer" : "jobcard.they_ask", { name: them, price })}
            {limit && <> {t(isWorker ? "jobcard.your_lowest" : "jobcard.your_limit", { price: limit })}</>}
          </p>
        )}
        {!waiting && <span className={C.muted}>{t("decide.takeover_body")}</span>}
        {/* Accepting their offer accepts its terms too: say what they are. */}
        <OfferTerms terms={last?.terms} />
      </div>
      <Controls {...props} waiting={waiting} />
    </fieldset>
  );
}

/**
 * While the agents talk (W9): the other side's latest offer as one row, as inDrive shows one (who, the amount large,
 * the usual range for the work), then the turn and the owner's own limit, which no offer crosses, in one muted line;
 * then "Take over from my agent", which opens the controls. Doing nothing leaves the agent to carry on.
 */
export function TakeOver(props: Props) {
  const { job, them } = props;
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const isWorker = job.engagement.role === Role.enum.provider;
  const turn = Math.min(job.offers_made, AGENT_OFFERS);
  const limit = job.mandate && jobPrice(lang, job.request, job.mandate.limit_paise);
  const latest = theirLatest(job);
  const usual = job.estimate && { low: money(job.estimate.low_paise), high: money(job.estimate.high_paise) };
  return (
    <div className={C.stack}>
      {latest && (
        <div className="offer-now">
          <Avatar name={them} size={AvatarSize.md} tone={AvatarTone.rust} />
          <span className="offer-now-who">
            <strong>{them}</strong>
            {usual && <span className="usual-chip">{t("jobcard.usual", usual)}</span>}
          </span>
          <span className="offer-now-price">{jobPrice(lang, job.request, latest.price_paise)}</span>
        </div>
      )}
      {(turn > 0 || limit) && (
        <p className={`${J.fine} turn-line`}>
          {turn > 0 && t("jobcard.turn", { count: turn, max: AGENT_OFFERS })}
          {turn > 0 && limit && " "}
          {limit && t(isWorker ? "jobcard.floor" : "jobcard.ceiling", { price: limit })}
        </p>
      )}
      {open ? (
        <Controls {...props} waiting={false} />
      ) : (
        <>
          <button type={C.button} className={J.second} onClick={() => setOpen(true)}>
            <Icon name="user" />
            {t("talks.take_over")}
          </button>
        </>
      )}
    </div>
  );
}
