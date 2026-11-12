import { type Advice, reasonText } from "@gigsync/core";
import type { Terms } from "@gigsync/protocol";
import { useI18n } from "../i18n.js";
import { Badge, BadgeTone } from "../ui/Badge.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import { J } from "./job/look.js";
import { TermsList } from "./terms/TermsList.js";

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

interface SignProps {
  /** The price as shown, with its unit when the job has one ("₹180 an hour"). */
  price: string;
  terms?: Terms | undefined;
  /** What the household asked for, so a term its agent took that differs is marked. */
  asked?: Terms | undefined;
  /** Where the work is, as the request names its locality; never the address, which only signing releases. */
  place?: string | undefined;
  /** The other side's name as the card shows it. */
  them: string;
  /** Their signature's hash, short, when they already signed these very terms. */
  theirHash?: string | undefined;
  say: string;
  onSign: () => void;
  onDecline: () => void;
}

/**
 * Both agents reached terms (W10, H9): the price as the card's hero, each term on its own line with a picture, the
 * other side's signature when they signed first, then one big Sign button that says the amount and a quiet Decline.
 * `say` reads the decision aloud; signing stays a tap.
 */
export function SignCard({ price, terms, asked, place, them, theirHash, say, onSign, onDecline }: SignProps) {
  const { lang, t } = useI18n();
  const deal = { price };
  return (
    <fieldset className={`${C.stack} sign-card`} aria-label={t("a11y.sign")}>
      <div className={`${J.earth} sign-hero`}>
        <div className="row-between">
          <span className={C.muted}>{t("job.reached")}</span>
          <SpeakButton lang={lang} text={say} />
        </div>
        <strong className="price-hero">{price}</strong>
      </div>
      {theirHash && (
        <span>
          <Badge icon="tick" tone={BadgeTone.green}>
            {t("jobcard.they_signed", { name: them, hash: theirHash })}
          </Badge>
        </span>
      )}
      <TermsList terms={terms} asked={asked} place={place} />
      <p className={J.fine}>{t("jobcard.sign_note", { name: them })}</p>
      <button type={C.button} className={J.hero} onClick={onSign}>
        <Icon name="tick" />
        {t("job.sign", deal)}
      </button>
      <button type={C.button} className={J.ghost} onClick={onDecline}>
        {t("job.decline")}
      </button>
    </fieldset>
  );
}
