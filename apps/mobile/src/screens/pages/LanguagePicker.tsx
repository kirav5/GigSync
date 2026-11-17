import { Lang } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** The owner's language, picked with one tap; every screen follows it at once. On About me and its own screen. */
export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <section className={C.card} aria-label={t("profile.language")}>
      <span className={C.label}>{t("profile.language")}</span>
      <fieldset className={C.row} aria-label={t("a11y.language")}>
        {Lang.options.map((l) => (
          <button
            key={l}
            type={C.button}
            lang={l}
            aria-pressed={lang === l}
            className={lang === l ? C.chipOn : C.chip}
            onClick={() => setLang(l)}
          >
            {t(`lang.${l}`)}
          </button>
        ))}
      </fieldset>
    </section>
  );
}
