import { TranslateState, type Translation, TranslationKind } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { preparePair } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/**
 * Words someone else wrote, shown as written, with a translation into the owner's language made on this phone
 * underneath (multilanguage plan §3.4): the original is always visible, the translation is marked and can be hidden,
 * and a translation that changed a number is withheld. With no `from`, or the owner's own language, it is plain text.
 */
export function Said({ text, from }: { text: string; from?: Lang | undefined }) {
  const { lang, t, translations } = useI18n();
  const foreign = from !== undefined && from !== lang && text.trim().length > 0;
  const [result, setResult] = useState<Translation>();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!foreign || from === undefined) return;
    let live = true;
    setResult(undefined);
    void translations.translate(text, from, lang).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [foreign, text, from, lang, translations]);

  // An engine echoes what it cannot or need not translate (a name, a number): nothing to add then.
  const same = result?.kind === TranslationKind.translated && result.text === text.trim();
  if (!foreign || from === undefined || same) return <span>{text}</span>;
  const name = t(`lang.${from}`);

  async function download() {
    if (from === undefined) return;
    await preparePair(from, lang);
    setResult(await translations.translate(text, from, lang));
  }

  return (
    <span className="said">
      <span lang={from}>{text}</span>
      {!result && <span className={C.faint}>{t("said.translating")}</span>}
      {result?.kind === TranslationKind.translated && (
        <span className="said-tr">
          {!hidden && <span lang={lang}>{result.text}</span>}
          <span className={C.faint}>
            {t("said.translated", { lang: name })} ·{" "}
            <button type={C.button} className={C.linkBtn} onClick={() => setHidden((h) => !h)}>
              {t(hidden ? "said.show" : "said.hide")}
            </button>
          </span>
        </span>
      )}
      {result?.kind === TranslationKind.unsafe && <span className={C.faint}>{t("said.unsafe", { lang: name })}</span>}
      {result?.kind === TranslationKind.unavailable &&
        (result.state === TranslateState.downloadable ? (
          <button type={C.button} className={C.linkBtn} onClick={() => void download()}>
            {t("said.download", { lang: name })}
          </button>
        ) : (
          <span className={C.faint}>{t("said.cannot", { lang: name })}</span>
        ))}
    </span>
  );
}
