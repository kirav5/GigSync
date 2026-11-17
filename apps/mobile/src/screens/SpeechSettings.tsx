import { useCloudConsent, withdrawCloud } from "../adapters/speech-settings.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { ListCard, ListRow } from "../ui/ListRow.js";

/**
 * Settings' Voice group, in the owner's language (amendment A1: the owner can see what runs): which companies they
 * allowed to turn their voice into text, each a row with a way to stop it. The recognizer and voice for the language
 * come by themselves (adapters/speech.ts), so there is nothing to download here; with no company allowed, the group is
 * not shown.
 */
export function SpeechSettings() {
  const { t } = useI18n();
  const allowed = useCloudConsent();
  if (allowed.length === 0) return null;

  return (
    <ListCard label={t("speech.title")}>
      {allowed.map((v) => (
        <ListRow
          key={v}
          icon="mic"
          title={t("speech.cloud_on", { vendor: t(`speech.vendor_${v}`) })}
          end={
            <button type={C.button} className={C.quiet} onClick={() => withdrawCloud(v)}>
              {t("speech.cloud_withdraw")}
            </button>
          }
        />
      ))}
    </ListCard>
  );
}
