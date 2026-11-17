import { type GigDevice, RequestState } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./mentor.css";
import { AskCard } from "./AskCard.js";
import { IntroCard } from "./IntroCard.js";
import { OfferCard } from "./RequestList.js";
import { useMentors } from "./useMentors.js";

interface Props {
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  syncedAt: Date | undefined;
}

/**
 * The mentor decisions on a worker's Home: newcomers asking this owner for help, mentors who offered to help this owner, and
 * introductions from people they know. Nothing shows when there is nothing to decide.
 */
export function MentorToday({ account, device, run, syncedAt }: Props) {
  const { t } = useI18n();
  const { incoming, requests, intros, prefs, refresh } = useMentors(device, syncedAt);
  const offers = requests.filter((r) => r.state === RequestState.offered);
  const common = { device, run, refresh };
  return (
    <>
      {incoming.length > 0 && (
        <section className={C.stack} aria-label={t("mentor.requests")}>
          <span className={C.label}>{t("mentor.requests")}</span>
          {incoming.map((ask) => (
            <AskCard key={ask.channel} account={account} ask={ask} {...common} />
          ))}
        </section>
      )}
      {offers.length > 0 && (
        <section className={C.stack} aria-label={t("mentor.offers")}>
          <span className={C.label}>{t("mentor.offers")}</span>
          {offers.map((r) => (
            <OfferCard key={r.channel} request={r} {...common} />
          ))}
        </section>
      )}
      {intros.length > 0 && (
        <section className={C.stack} aria-label={t("mentor.intros")}>
          <span className={C.label}>{t("mentor.intros")}</span>
          {intros.map((i) => (
            <IntroCard key={i.channel} intro={i} safetySeen={prefs.safety_seen === true} {...common} />
          ))}
        </section>
      )}
    </>
  );
}
