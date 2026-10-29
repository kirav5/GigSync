import { Lang } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { ENGINE_NAMES, NO_ENGINE, pairStatus } from "../adapters/translate.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/**
 * What translates other people's words into the owner's language on this phone: the engine, and that nothing leaves
 * the phone. Language packs are fetched by themselves (on choosing a language, or a tap while a line waits for one),
 * so there is nothing to download here (multilanguage plan §7.2: the owner can see what runs).
 */
export function TranslationSettings() {
  const { lang, t } = useI18n();
  const [engine, setEngine] = useState<string>();

  useEffect(() => {
    let live = true;
    const from = Lang.options.filter((l) => l !== lang);
    void Promise.all(from.map((f) => pairStatus(f, lang))).then((pairs) => {
      if (live) setEngine(pairs.find((p) => p.engine !== NO_ENGINE)?.engine ?? NO_ENGINE);
    });
    return () => {
      live = false;
    };
  }, [lang]);

  return (
    <section className={C.card} aria-label={t("translation.title")}>
      <span className={C.label}>{t("translation.title")}</span>
      {engine !== undefined && (
        <span className={C.muted}>
          {engine === NO_ENGINE
            ? t("translation.none")
            : t("translation.engine", { engine: ENGINE_NAMES[engine] ?? engine })}
        </span>
      )}
      <span className={C.faint}>{t("translation.about")}</span>
    </section>
  );
}
