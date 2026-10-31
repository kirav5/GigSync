import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { InstallCard } from "../ui/InstallCard.js";

/** Ties the dock's Continue, outside the form, to it. */
const FORM_ID = "language";

/**
 * The first screen, before the app knows the owner's language. One list, made from the languages the app ships,
 * each named in its own script; the heading and button speak the selected language, starting from the phone's own,
 * and change as the owner picks, as Android's and iOS's own setup screens do. A new language is one more catalog,
 * not one more heading. The page itself is still `lang="en"` here, so the form (and the dock's button) carry the
 * picked language: its type sizes and line height follow it (styles.css, `:lang`).
 */
export function LanguageChooser({ suggested, onChoose }: { suggested: Lang; onChoose: (lang: Lang) => void }) {
  const [picked, setPicked] = useState(suggested);

  function submit(e: FormEvent) {
    e.preventDefault();
    onChoose(picked);
  }

  return (
    <form
      id={FORM_ID}
      className={`${C.stack} ${C.textRoot}`}
      lang={picked}
      onSubmit={submit}
      aria-label={t(picked, "onboard.title")}
    >
      <h1 className={C.headline}>{t(picked, "onboard.title")}</h1>
      <InstallCard lang={picked} />
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
      <span className={C.faint}>{t(picked, "onboard.later")}</span>
      <Dock>
        <button type={C.submit} form={FORM_ID} className={C.wide} lang={picked}>
          {t(picked, "onboard.continue")}
        </button>
      </Dock>
    </form>
  );
}
