import type { CheckedId } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon, type IconName } from "../../ui/Icon.js";

/** The round badge at the top of each state, and its title under it. */
export const SEAL = "verify-seal";
export const TITLE = "verify-title";
const LINE = "verify-line";
export const TICK: IconName = "check";
/** The last 4 digits as the card line shows them, the rest never known. */
const MASK = "•••• ";
const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/** "Is this your own Aadhaar?", once the Aadhaar is genuine and its mobile is the holder's. */
export function ConfirmOwn({ id, onYes, onNo }: { id: CheckedId; onYes: () => void; onNo: () => void }) {
  const { t } = useI18n();
  return (
    <section className={`${C.stack} verify`} aria-label={t("idcheck.confirm_title")}>
      <span className={SEAL} data-done>
        <Icon name={TICK} size={44} />
      </span>
      <h1 className={TITLE}>{t("idcheck.confirm_title")}</h1>
      <p className={LINE}>{t("idcheck.confirm_line", { name: id.name })}</p>
      <p className={C.muted}>{t("idcheck.confirm_why")}</p>
      <button type={C.button} className={`${C.wide} btn-big`} onClick={onYes}>
        {t("idcheck.confirm_yes")}
      </button>
      <button type={C.button} className={C.secondary} onClick={onNo}>
        {t("idcheck.confirm_no")}
      </button>
    </section>
  );
}

/** The kept check: the card's few fields and when it was checked. */
export function Verified({ id, onAgain }: { id: CheckedId; onAgain: () => void }) {
  const { lang, t } = useI18n();
  return (
    <section className={`${C.stack} verify`} aria-label={t("idcheck.verified_title")}>
      <span className={SEAL} data-done>
        <Icon name={TICK} size={44} />
      </span>
      <h1 className={TITLE}>{t("idcheck.verified_title")}</h1>
      <p className={LINE}>
        {t("idcheck.card_line", { name: id.name, year: id.birthYear, last4: `${MASK}${id.aadhaarLast4}` })}
      </p>
      <p className={C.muted}>
        {t("idcheck.checked_on", { date: new Date(id.checkedAt).toLocaleDateString(lang, DATE) })}
      </p>
      <p className="verify-pill">{t("idcheck.shown_where")}</p>
      <button type={C.button} className={C.secondary} onClick={onAgain}>
        {t("idcheck.again")}
      </button>
    </section>
  );
}

/** A genuine Aadhaar with no mobile linked: nothing to bind it to the holder, so no badge until they link one. */
export function NotLinked({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <section className={`${C.stack} verify`} aria-label={t("idcheck.not_linked_title")}>
      <span className={SEAL}>
        <Icon name="phone" size={44} />
      </span>
      <h1 className={TITLE}>{t("idcheck.not_linked_title")}</h1>
      <p className={LINE}>{t("idcheck.not_linked")}</p>
      <button type={C.button} className={C.secondary} onClick={onBack}>
        {t("idcheck.back")}
      </button>
    </section>
  );
}
