import { TranslateState, type Translation, TranslationKind } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect, useState, useSyncExternalStore } from "react";
import { packsChanged, packTried, wantPair } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** While a pack is downloading, how often a line checks whether it can translate yet. */
const DOWNLOAD_POLL_MS = 3000;

/** What a line of someone else's words is showing, on `data-said`, for tests and styles. */
const DataSaid = { translated: "translated", original: "original", pending: "pending" } as const;

/**
 * Words someone else wrote, read only in the owner's language: the phone's translation, with no note about the
 * language it came from. While the phone is still translating, or its pack is on the way (fetched on the owner's next
 * tap, never by a button), a faint line says so. The original shows only when there is nothing safe to show instead,
 * always beside the reason: the translation changed a number, or this phone cannot translate the pair. The original
 * is still what both sides sign.
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
      if (r.kind === TranslationKind.unavailable && r.state === TranslateState.downloadable) wantPair(from, lang);
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

  if (result?.kind === TranslationKind.translated)
    return (
      <span lang={lang} data-said={DataSaid.translated}>
        {result.text}
      </span>
    );
  // Asking the engine takes a moment, and a pack on its way (or wanted at the next tap) will be asked again: no
  // foreign words meanwhile.
  // A pack already asked for and still missing is not coming: then the original shows, with the reason.
  const waiting =
    result?.kind === TranslationKind.unavailable &&
    (result.state === TranslateState.downloading ||
      (result.state === TranslateState.downloadable && !packTried(from, lang)));
  if (!result || waiting)
    return (
      <span className={C.faint} data-said={DataSaid.pending}>
        {t("said.translating")}
      </span>
    );

  const name = t(`lang.${from}`);
  const why =
    result.kind === TranslationKind.unsafe ? (
      <span className={C.faint}>{t("said.unsafe", { lang: name })}</span>
    ) : (
      <span className={C.faint}>{t("said.cannot", { lang: name })}</span>
    );
  return (
    <>
      <span lang={from} data-said={DataSaid.original}>
        {text}
      </span>{" "}
      {why}
    </>
  );
}
