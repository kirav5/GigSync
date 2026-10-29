import type { Lang } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { canSpeak, speak } from "../adapters/speech.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import "./composer.css";

/**
 * A speaker button that reads `text` aloud in `lang`, for an owner who would rather hear a question or a decision than
 * read it. It only speaks; deciding stays a tap. Renders nothing on a phone with no local voice for the language.
 */
export function SpeakButton({ lang, text }: { lang: Lang; text: string }) {
  const { t } = useI18n();
  const [can, setCan] = useState(false);

  useEffect(() => {
    let live = true;
    void canSpeak(lang).then((ok) => {
      if (live) setCan(ok);
    });
    return () => {
      live = false;
    };
  }, [lang]);

  if (!can) return null;
  return (
    <button
      type={C.button}
      className="speak-btn"
      aria-label={t("speech.replay")}
      onClick={() => {
        // A voice that went away since the check just stays quiet.
        speak(lang, text).catch(() => {});
      }}
    >
      <Icon name="speaker" size={22} />
    </button>
  );
}
