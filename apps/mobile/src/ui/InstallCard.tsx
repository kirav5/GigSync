import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useState } from "react";
import { dismiss, dismissed, InstallState, install, useInstallState } from "../adapters/install.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import "./install.css";

/**
 * Offered on sign-in's number step only where the step is quick (Chrome's prompt) or must come first (iPhone: the
 * home-screen app keeps its own storage, so installing after sign-in would start a second, empty phone). Once signed
 * in, Settings' Install app opens the browser's prompt or the Install screen instead.
 */
const OFFERED: readonly InstallState[] = [InstallState.prompt, InstallState.ios];

/**
 * Offers to put the web app on the home screen before sign-in, as one quiet row under the number: an icon, what it
 * gives, and a small button (or, on iPhone, the one step to take and why now). "Not now" is the × in the corner.
 * Takes `lang`, so it also works outside I18nProvider.
 */
export function InstallCard({ lang }: { lang: Lang }) {
  const state = useInstallState();
  const [hidden, setHidden] = useState(dismissed);
  if (hidden || !OFFERED.includes(state)) return null;

  function later() {
    dismiss();
    setHidden(true);
  }

  return (
    <section className={`${C.card} install`} lang={lang} aria-label={t(lang, "install.title")}>
      <span className="install-badge" aria-hidden="true">
        <Icon name="install" size={18} />
      </span>
      <span className="install-text">
        <span className="install-title">{t(lang, "install.title")}</span>
        <span className="install-about">{t(lang, "install.about")}</span>
      </span>
      <button
        type={C.button}
        className={`${C.quiet} install-later`}
        aria-label={t(lang, "install.later")}
        title={t(lang, "install.later")}
        onClick={later}
      >
        <Icon name="close" size={16} />
      </button>
      <span className="install-action">
        {state === InstallState.prompt && (
          <button type={C.button} className={C.secondary} onClick={() => void install()}>
            <Icon name="install" size={16} />
            {t(lang, "install.button")}
          </button>
        )}
        {state === InstallState.ios && (
          <span className="install-step">
            <Icon name="share" size={16} />
            {t(lang, "install.ios")}
          </span>
        )}
        {state === InstallState.ios && <span className="install-first">{t(lang, "install.ios_first")}</span>}
      </span>
    </section>
  );
}
