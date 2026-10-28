import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { C } from "../ui/cls.js";

/**
 * The first screen, before the app knows the owner's language. One list, made from the languages the app ships,
 * each named in its own script; the heading and button speak the selected language, starting from the phone's own,
 * and change as the owner picks, as Android's and iOS's own setup screens do. A new language is one more catalog,
 * not one more heading.
 */
export function LanguageChooser({ suggested, onChoose }: { suggested: Lang; onChoose: (lang: Lang) => void }) {
  const [picked, setPicked] = useState(suggested);

  function submit(e: FormEvent) {
    e.preventDefault();
    onChoose(picked);
  }

  return (
    <form className={C.stack} lang={picked} onSubmit={submit} aria-label={t(picked, "onboard.title")}>
      <h1 className={C.headline}>{t(picked, "onboard.title")}</h1>
      <fieldset className="lang-list" aria-label={t(picked, "a11y.language")}>
        {Lang.options.map((l) => (
          <label key={l} className={l === picked ? "lang-option on" : "lang-option"}>
            <input type="radio" name="lang" value={l} checked={l === picked} onChange={() => setPicked(l)} />
            <span lang={l} className="lang-native">
              {t(l, `lang.${l}`)}
            </span>
            {l !== picked && <span className={C.faint}>{t(picked, `lang.${l}`)}</span>}
          </label>
        ))}
      </fieldset>
      <button type={C.submit} className={C.wide}>
        {t(picked, "onboard.continue")}
      </button>
      <span className={C.faint}>{t(picked, "onboard.later")}</span>
    </form>
  );
}
