import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { Fragment, useId } from "react";
import { Brand } from "../ui/Brand.js";
import { C } from "../ui/cls.js";
import { SpeakButton } from "../ui/SpeakButton.js";
import { Art, StartArt } from "./start/StartArt.js";
import "./start/start.css";

const { kn, hi } = Lang.enum;
/**
 * Kannada, then Hindi, then the rest: the pilot is in Bengaluru, where most workers read one of the two first. Only the
 * screen's order; the protocol's (Lang.options) stays as it is, and a new language still needs only its catalog.
 */
const LEAD: readonly Lang[] = [kn, hi];
const ORDER: readonly Lang[] = [...LEAD, ...Lang.options.filter((l) => !LEAD.includes(l))];
const BETWEEN = " · ";

/**
 * The first screen, before the app knows the owner's language: hello in each language, then one big row per language,
 * named in its own script with a speaker that says the name aloud. A tap on a row chooses it and moves on; there is
 * no Continue. Until then the page is in the phone's own language (`suggested`), so the instructions and each
 * language's name under its own are in that one, and each row carries its language (styles.css `:lang` type sizes).
 */
export function LanguageChooser({ suggested, onChoose }: { suggested: Lang; onChoose: (lang: Lang) => void }) {
  const id = useId();
  return (
    <section className={`${C.stack} ${C.textRoot} start`} lang={suggested} aria-label={t(suggested, "onboard.title")}>
      <Brand />
      <StartArt art={Art.welcome} />
      <div className="start-head">
        <h1 className={C.headline}>
          {ORDER.map((l, i) => (
            <Fragment key={l}>
              {i > 0 && BETWEEN}
              <span lang={l}>{t(l, "start.hello")}</span>
            </Fragment>
          ))}
        </h1>
        <p className={C.muted}>{t(suggested, "start.tap")}</p>
      </div>
      <ul className="lang-rows" aria-label={t(suggested, "a11y.language")}>
        {ORDER.map((l) => {
          const name = t(l, `lang.${l}`);
          const own = l === suggested;
          return (
            <li key={l} className="lang-row" lang={l}>
              <button
                type={C.button}
                className="option-row"
                aria-labelledby={`${id}-${l}`}
                aria-describedby={own ? undefined : `${id}-${l}-in`}
                onClick={() => onChoose(l)}
              >
                <span id={`${id}-${l}`} className="lang-name">
                  {name}
                </span>
                {!own && (
                  <span id={`${id}-${l}-in`} className="sub" lang={suggested}>
                    {t(suggested, `lang.${l}`)}
                  </span>
                )}
              </button>
              <SpeakButton lang={l} text={name} label={t(l, "start.hear", { lang: name })} />
            </li>
          );
        })}
      </ul>
      <p className="fine start-foot">{t(suggested, "onboard.later")}</p>
    </section>
  );
}
