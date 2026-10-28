import { TranslateState, type Translation, TranslationKind } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect, useState, useSyncExternalStore } from "react";
import { packsChanged, preparePair } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** While a pack is downloading, how often a line checks whether it can translate yet. */
const DOWNLOAD_POLL_MS = 3000;

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
  // A pack fetched anywhere on screen, or one still downloading, makes this line ask again.
  const packs = useSyncExternalStore(packsChanged.subscribe, packsChanged.version);
  const [retry, setRetry] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `packs` and `retry` only exist to run this again.
  useEffect(() => {
    if (!foreign || from === undefined) return;
    let live = true;
    setResult(undefined);
    let again: ReturnType<typeof setTimeout> | undefined;
    void translations.translate(text, from, lang).then((r) => {
      if (!live) return;
      setResult(r);
      if (r.kind === TranslationKind.unavailable && r.state === TranslateState.downloading)
        again = setTimeout(() => setRetry((n) => n + 1), DOWNLOAD_POLL_MS);
    });
    return () => {
      live = false;
      clearTimeout(again);
    };
  }, [foreign, text, from, lang, translations, packs, retry]);

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
      {(!result || (result.kind === TranslationKind.unavailable && result.state === TranslateState.downloading)) && (
        <span className={C.faint}>{t("said.translating")}</span>
      )}
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
        result.state !== TranslateState.downloading &&
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
