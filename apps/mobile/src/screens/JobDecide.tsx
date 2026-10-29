import { type Advice, reasonText } from "@gigsync/core";
import type { QuestionKey } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { SpeakButton } from "../ui/SpeakButton.js";

/** What the worker's agent puts on the approval task: what tripped the rule, and the plan it would quote from. */
export interface ApproveDetail {
  flagged: QuestionKey[];
  advice: Advice;
}

/** The worker's agent's price plan and why, in the owner's language. Private: it never leaves this phone. */
export function PlanCard({ advice }: { advice: Advice }) {
  const { lang, t } = useI18n();
  return (
    <fieldset className={C.stack} aria-label={t("a11y.plan")}>
      <span className={C.label}>{t("plan.title")}</span>
      <ul className={C.stack}>
        {advice.reasons.map((r) => (
          <li key={r.kind + ("key" in r ? r.key : "")} className={C.muted}>
            {reasonText(lang, r)}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * The job has something the worker asked to see first: nothing is quoted until they say go ahead or no. `say` is the
 * decision in a sentence, read aloud from the speaker button; taking or declining stays a tap.
 */
export function ApproveCard({
  detail,
  say,
  onApprove,
  onDecline,
}: {
  detail: ApproveDetail;
  say: string;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const { lang, t } = useI18n();
  const items = detail.flagged.map((k) => t(`detail.${k}`)).join(", ");
  return (
    <fieldset className={C.stack} aria-label={t("a11y.approve")}>
      <div className={C.row}>
        <SpeakButton lang={lang} text={say} />
        <span className={C.label}>{t("approve.title")}</span>
      </div>
      <span>{t("approve.flagged", { items })}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onApprove}>
          {t("approve.yes", { price: money(detail.advice.mandate.opening_paise) })}
        </button>
        <button type={C.button} className={C.secondary} onClick={onDecline}>
          {t("approve.no")}
        </button>
      </div>
    </fieldset>
  );
}

/** Both agents reached terms: sign at that price, or decline. `say` reads the decision aloud; signing stays a tap. */
export function SignCard({
  price,
  say,
  onSign,
  onDecline,
}: {
  price: number;
  say: string;
  onSign: () => void;
  onDecline: () => void;
}) {
  const { lang, t } = useI18n();
  const deal = { price: money(price) };
  return (
    <fieldset className={C.stack} aria-label={t("a11y.sign")}>
      <div className={C.row}>
        <SpeakButton lang={lang} text={say} />
        <span className={C.muted}>{t("job.reached", deal)}</span>
      </div>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onSign}>
          {t("job.sign", deal)}
        </button>
        <button type={C.button} className={C.secondary} onClick={onDecline}>
          {t("job.decline")}
        </button>
      </div>
    </fieldset>
  );
}
