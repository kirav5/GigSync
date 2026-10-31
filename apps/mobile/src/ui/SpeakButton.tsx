import type { Lang } from "@gigsync/protocol";
import { useEffect, useRef } from "react";
import { knownVoice, prepareSpeak, speak, speakState, VoiceState, waitsForDownload } from "../adapters/speech.js";
import { useSpeechState } from "../adapters/speech-watch.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import "./composer.css";

/** Speaks; a voice that went away since the check just stays quiet. */
function play(lang: Lang, text: string): void {
  speak(lang, text).catch(() => {});
}

/**
 * A speaker button that reads `text` aloud in `lang`, for an owner who would rather hear a question or a decision than
 * read it. It only speaks; deciding stays a tap. A voice the phone can fetch is fetched by the tap and speaks once it
 * is here; the button renders nothing on a phone with no local voice for the language, or one that did not come, and
 * shows again when one is installed while the app was away.
 */
export function SpeakButton({ lang, text }: { lang: Lang; text: string }) {
  const { t } = useI18n();
  const [voice, setVoice] = useSpeechState(lang, knownVoice, speakState);
  /** Tapped while the voice was still coming: it speaks when it arrives, if the button is still on screen. */
  const playWhenReady = useRef(false);

  const ready = voice?.state === VoiceState.available;
  useEffect(() => {
    if (!voice || waitsForDownload(voice)) return;
    // Arrived: it speaks now. Not coming: a voice installed later must not speak by itself.
    if (ready && playWhenReady.current) play(lang, text);
    playWhenReady.current = false;
  }, [voice, ready, lang, text]);

  async function tap() {
    if (ready) return play(lang, text);
    playWhenReady.current = true;
    if (voice?.state === VoiceState.downloadable) setVoice(await prepareSpeak(lang));
  }

  if (!ready && !waitsForDownload(voice)) return null;
  return (
    <button type={C.button} className="speak-btn" aria-label={t("speech.replay")} onClick={() => void tap()}>
      <Icon name="speaker" size={22} />
    </button>
  );
}
