import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { C } from "../ui/cls.js";

/**
 * The first screen: three big buttons, each language named in its own script, and the heading in all three, so
 * someone who reads only one of them can still choose. Everything after this speaks the chosen language.
 */
export function LanguageChooser({ suggested, onChoose }: { suggested: Lang; onChoose: (lang: Lang) => void }) {
  return (
    <div className={C.stack}>
      {Lang.options.map((l) => (
        <h1 key={l} lang={l} className={C.headline}>
          {t(l, "onboard.title")}
        </h1>
      ))}
      <fieldset className={C.stack} aria-label={Lang.options.map((l) => t(l, "a11y.language")).join(" · ")}>
        {Lang.options.map((l) => (
          <button
            key={l}
            type={C.button}
            lang={l}
            className={l === suggested ? C.wide : `${C.secondary} wide`}
            onClick={() => onChoose(l)}
          >
            {t(l, `lang.${l}`)}
          </button>
        ))}
      </fieldset>
      {Lang.options.map((l) => (
        <span key={l} lang={l} className={C.faint}>
          {t(l, "onboard.later")}
        </span>
      ))}
    </div>
  );
}
