import { TranslateState } from "@gigsync/core";
import type { PairStatus } from "@gigsync/plugin-translate";
import { Lang } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { ENGINE_NAMES, NO_ENGINE, pairStatus, preparePair } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/**
 * What translates other people's words into the owner's language on this phone, pair by pair, with a download button
 * where a language pack exists but is not here yet (multilanguage plan §7.2: the owner can see what runs).
 */
export function TranslationSettings() {
  const { lang, t } = useI18n();
  const sources = Lang.options.filter((l) => l !== lang);
  const [status, setStatus] = useState<Partial<Record<Lang, PairStatus>>>({});

  useEffect(() => {
    let live = true;
    const from = Lang.options.filter((l) => l !== lang);
    void Promise.all(from.map(async (f) => [f, await pairStatus(f, lang)] as const)).then((pairs) => {
      if (live) setStatus(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  }, [lang]);

  async function download(from: Lang) {
    setStatus((s) => ({ ...s, [from]: { state: TranslateState.downloading, engine: s[from]?.engine ?? "" } }));
    const next = await preparePair(from, lang);
    setStatus((s) => ({ ...s, [from]: next }));
  }

  const engine = Object.values(status).find((s) => s && s.engine !== NO_ENGINE)?.engine;
  return (
    <section className={C.card} aria-label={t("translation.title")}>
      <span className={C.label}>{t("translation.title")}</span>
      <span className={C.muted}>
        {engine ? t("translation.engine", { engine: ENGINE_NAMES[engine] ?? engine }) : t("translation.none")}
      </span>
      {sources.map((from) => {
        const s = status[from];
        return (
          <div key={from} className={C.row}>
            <span className={C.muted}>
              {t("translation.pair", {
                from: t(`lang.${from}`),
                to: t(`lang.${lang}`),
                state: s ? t(`tstate.${s.state}`) : "…",
              })}
            </span>
            {s?.state === TranslateState.downloadable && (
              <button type={C.button} className={`${C.linkBtn} end`} onClick={() => void download(from)}>
                {t("translation.download")}
              </button>
            )}
          </div>
        );
      })}
      <span className={C.faint}>{t("translation.about")}</span>
    </section>
  );
}
