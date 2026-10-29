import type { SpeechStatus } from "@gigsync/plugin-speech";
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

  const langName = t(`lang.${lang}`);
  const fetchListen = waitsForDownload(hear);
  const fetchSpeak = waitsForDownload(say);
  // Only what the owner can act on: a voice to fetch, or a company they allowed to hear them and may stop.
  if (!fetchListen && !fetchSpeak && allowed.length === 0) return null;

  return (
    <section className={C.card} aria-label={t("speech.title")}>
      <span className={C.label}>{t("speech.title")}</span>
      {fetchListen && (
        <button type={C.button} className={C.linkBtn} disabled={hearLoading} onClick={() => void getListen()}>
          {t("speech.download", { lang: langName })}
        </button>
      )}
      {fetchSpeak && (
        <button type={C.button} className={C.linkBtn} disabled={sayLoading} onClick={() => void getSpeak()}>
          {t("speech.download_voice", { lang: langName })}
        </button>
      )}
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
