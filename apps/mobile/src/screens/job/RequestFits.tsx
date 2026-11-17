import { type Advice, type JobRecord, type Mandate, type WorkerRules, workerStance } from "@gigsync/core";
import type { QuestionKey } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { PlaceMap } from "../../ui/PlaceMap.js";
import { jobPrice } from "../../ui/places.js";
import { SpeakButton } from "../../ui/SpeakButton.js";
import { J } from "./look.js";

/** What the worker's agent puts on the approval task: what tripped the rule, and the plan it would quote from. */
export interface ApproveDetail {
  flagged: QuestionKey[];
  advice: Advice;
  /** The plan the agent would quote from; the advice's own when it gave one. */
  mandate?: Mandate;
  /** The worker's lowest price is not on this phone yet (their card came back from the board): every request waits. */
  no_floor?: boolean;
}

interface Props {
  job: JobRecord;
  detail: ApproveDetail;
  /** The worker's own rules, for the distance and the hours on their card; without them those ticks stay general. */
  rules?: WorkerRules | undefined;
  /** The decision in a sentence, read aloud from the speaker button; taking or declining stays a tap. */
  say: string;
  onApprove: () => void;
  onDecline: () => void;
}

/**
 * A request the worker asked to see before their agent quotes (W8): where it is, then what this phone checked as
 * ticks, then the agent's question and one tap to let it go ahead. Only what is true goes in a tick: the agent turns
 * down work off the card or out of range before it ever gets here, and the hours are checked against the card when
 * the request names a time. The household's budget never leaves its phone, so nothing claims what it pays.
 */
export function RequestFits({ job, detail, rules, say, onApprove, onDecline }: Props) {
  const { lang, t } = useI18n();
  const request = job.request;
  const plan = detail.mandate ?? detail.advice.mandate;
  const price = (paise: number) => jobPrice(lang, request, paise);
  const when = request.terms?.when;
  // Checked only when both are known: the card's days and hours, and a time the household named.
  const inHours = rules?.terms && when ? workerStance(rules.terms, []).accepts.when(when) : undefined;
  const items = detail.flagged.map((k) => t(`detail.${k}`)).join(", ");
  return (
    <fieldset className={`${C.stack} fit-card`} aria-label={t("a11y.approve")}>
      <div className="row-between">
        <span className={C.label}>{t("approve.title")}</span>
        <SpeakButton lang={lang} text={say} />
      </div>
      {/* The request's coarse point, never the door: named by its locality when the household's phone gave one. */}
      {request.locality && <PlaceMap at={request.area} label={t("map.of", { place: request.locality })} />}
      <div className={J.sage}>
        <p className={J.label}>{t("jobcard.fit_title")}</p>
        <ul className="tick-list">
          <li>{t("jobcard.fit_work")}</li>
          <li>{rules ? t("jobcard.fit_near_km", { km: rules.radius_km }) : t("jobcard.fit_near")}</li>
          {inHours && <li>{t("jobcard.fit_hours")}</li>}
          {!detail.no_floor && <li>{t("jobcard.fit_floor", { price: price(plan.limit_paise) })}</li>}
        </ul>
        {inHours === false && <p className={J.fine}>{t("jobcard.fit_off_hours")}</p>}
        {detail.flagged.length > 0 && <p className={J.fine}>{t("approve.flagged", { items })}</p>}
        {detail.no_floor && <p className={J.fine}>{t("phone.approve_no_floor")}</p>}
      </div>
      <div className="msg-agent">
        <p>{t("jobcard.fit_ask", { price: price(plan.opening_paise) })}</p>
      </div>
      <button type={C.button} className={J.hero} onClick={onApprove}>
        <Icon name="tick" />
        {t("approve.yes")}
      </button>
      <button type={C.button} className={J.ghost} onClick={onDecline}>
        {t("approve.no")}
      </button>
      <p className={J.fine}>{t("jobcard.lowest_stays")}</p>
    </fieldset>
  );
}
