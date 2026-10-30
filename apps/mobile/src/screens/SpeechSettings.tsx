import { useCloudConsent, withdrawCloud } from "../adapters/speech-settings.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/** A link-styled button at the end of its row. */
const LINK_END = `${C.linkBtn} end`;

/**
 * Settings' Voice section, in the owner's language (amendment A1: the owner can see what runs): which companies they
 * allowed to turn their voice into text, each with a way to stop it. The recognizer and voice for the language come by
 * themselves (adapters/speech.ts), so there is nothing to download here; with no company allowed, the section is not
 * shown.
 */
export function SpeechSettings() {
  const { t } = useI18n();
  const allowed = useCloudConsent();
  if (allowed.length === 0) return null;

  return (
    <section className={C.card} aria-label={t("speech.title")}>
      <span className={C.label}>{t("speech.title")}</span>
      {allowed.map((v) => (
        <div key={v} className={C.row}>
          <span className={C.muted}>{t("speech.cloud_on", { vendor: t(`speech.vendor_${v}`) })}</span>
          <button type={C.button} className={LINK_END} onClick={() => withdrawCloud(v)}>
            {t("speech.cloud_withdraw")}
          </button>
        </div>
      ))}
    </section>
  );
}
