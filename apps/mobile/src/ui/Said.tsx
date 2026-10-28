import { TranslateState, type Translation, TranslationKind } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect, useState, useSyncExternalStore } from "react";
import { packsChanged, preparePair } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** While a pack is downloading, how often a line checks whether it can translate yet. */
const DOWNLOAD_POLL_MS = 3000;

/**
 * Words someone else wrote, read only in the owner's language: the phone's translation, marked as a machine
 * translation. The original shows only when there is nothing safe to show instead (no pack yet, no engine, or a
 * translation that changed a number), with a note saying why. The original is still what both sides sign.
 * With no `from`, or the owner's own language, it is plain text.
 */
export function Said({ text, from }: { text: string; from?: Lang | undefined }) {
  const { lang, t, translations } = useI18n();
  const foreign = from !== undefined && from !== lang && text.trim().length > 0;
  const [result, setResult] = useState<Translation>();
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

  if (result?.kind === TranslationKind.translated)
    return (
      <span className="said">
        <span lang={lang}>{result.text}</span>
        <span className={C.faint}>{t("said.translated", { lang: name })}</span>
      </span>
    );
  // Asking the engine takes a moment; the foreign words appear only if no translation comes.
  if (!result) return <span className={`said ${C.faint}`}>{t("said.translating")}</span>;

  return (
    <span className="said">
      <span lang={from}>{text}</span>
      {result.kind === TranslationKind.unavailable && result.state === TranslateState.downloading && (
        <span className={C.faint}>{t("said.translating")}</span>
      )}
      {result.kind === TranslationKind.unsafe && <span className={C.faint}>{t("said.unsafe", { lang: name })}</span>}
      {result.kind === TranslationKind.unavailable &&
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
