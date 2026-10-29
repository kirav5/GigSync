import type { SpeechState, SpeechStatus } from "@gigsync/plugin-speech";
import { useEffect, useState } from "react";
import {
  listenState,
  prepareListen,
  prepareSpeak,
  speakState,
  VoiceState,
  waitsForDownload,
  watchDownload,
} from "../adapters/speech.js";
import { useCloudConsent, withdrawCloud } from "../adapters/speech-settings.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/** On-device engines by name; a cloud recognizer is named by its company instead (`speech.vendor_*`). */
const ENGINE_NAMES: Readonly<Record<string, string>> = {
  "android-ondevice": "Android",
  "apple-ondevice": "Apple",
  "chrome-ondevice": "Chrome",
};
/** A link-styled button at the end of its row. */
const LINK_END = `${C.linkBtn} end`;

/**
 * Profile's Voice section, in the owner's language (amendment A1: the owner can see what runs): whether voice typing
 * and reading aloud work, which engine listens and whether the voice stays on the phone or goes to a company, the
 * downloads (only from a tap), the read-aloud switch, and a way to stop sending the voice to a company they allowed.
 */
export function SpeechSettings() {
  const { lang, t } = useI18n();
  const [hear, setHear] = useState<SpeechStatus>();
  const [say, setSay] = useState<SpeechStatus>();
  const allowed = useCloudConsent();

  useEffect(() => {
    let live = true;
    void Promise.all([listenState(lang), speakState(lang)]).then(([h, s]) => {
      if (!live) return;
      setHear(h);
      setSay(s);
    });
    return () => {
      live = false;
    };
  }, [lang]);

  // Downloads finish in the background: while one runs, its state is read again until it changes (round2-spec §1.5).
  const hearLoading = hear?.state === VoiceState.downloading;
  const sayLoading = say?.state === VoiceState.downloading;
  useEffect(() => (hearLoading ? watchDownload(() => listenState(lang), setHear) : undefined), [hearLoading, lang]);
  useEffect(() => (sayLoading ? watchDownload(() => speakState(lang), setSay) : undefined), [sayLoading, lang]);

  async function getListen() {
    if (hear) setHear({ ...hear, state: VoiceState.downloading });
    setHear(await prepareListen(lang));
  }

  async function getSpeak() {
    if (say) setSay({ ...say, state: VoiceState.downloading });
    setSay(await prepareSpeak(lang));
  }

  const word = (s: SpeechState | undefined) =>
    s === undefined ? "…" : s === VoiceState.denied ? t("speech.state_denied") : t(`tstate.${s}`);
  const langName = t(`lang.${lang}`);
  const onDevice = hear?.state === VoiceState.available;
  const vendor = hear?.cloud?.vendor;
  const cloud = !onDevice && hear?.state !== VoiceState.denied && vendor !== undefined && allowed.includes(vendor);
  const vendorName = vendor ? t(`speech.vendor_${vendor}`) : "";
  const engine = onDevice && hear ? (ENGINE_NAMES[hear.engine] ?? hear.engine) : cloud ? vendorName : undefined;

  return (
    <section className={C.card} aria-label={t("speech.title")}>
      <span className={C.label}>{t("speech.title")}</span>
      <span className={C.muted}>{t("speech.about")}</span>
      <div className={C.row}>
        <span className={C.muted}>
          {t("speech.listen_state", { lang: langName, state: word(cloud ? VoiceState.available : hear?.state) })}
        </span>
        {waitsForDownload(hear) && (
          <button type={C.button} className={LINK_END} disabled={hearLoading} onClick={() => void getListen()}>
            {t("speech.download", { lang: langName })}
          </button>
        )}
      </div>
      {engine && (
        <span className={C.muted}>
          {t("translation.engine", { engine })} ·{" "}
          {cloud ? t("speech.where_cloud", { vendor: vendorName }) : t("speech.where_device")}
        </span>
      )}
      <div className={C.row}>
        <span className={C.muted}>{t("speech.speak_state", { lang: langName, state: word(say?.state) })}</span>
        {waitsForDownload(say) && (
          <button type={C.button} className={LINK_END} disabled={sayLoading} onClick={() => void getSpeak()}>
            {t("translation.download")}
          </button>
        )}
      </div>
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
