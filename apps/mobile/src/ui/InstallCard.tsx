import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useState } from "react";
import { dismiss, dismissed, InstallState, install, useInstallState } from "../adapters/install.js";
import { C } from "./cls.js";
import { Icon } from "./Icon.js";
import "./install.css";

/** Where the card shows: the language screen before sign-in, or Profile. */
export const InstallPlace = { onboarding: "onboarding", settings: "settings" } as const;
export type InstallPlace = (typeof InstallPlace)[keyof typeof InstallPlace];

/**
 * Where each state is offered. Profile always offers it on the web; the language screen only where the step is
 * quick (Chrome's prompt) or must come first (iPhone: the home-screen app keeps its own storage, so installing after
 * sign-in would start a second, empty phone).
 */
const OFFERED: Readonly<Record<InstallPlace, readonly InstallState[]>> = {
  [InstallPlace.onboarding]: [InstallState.prompt, InstallState.ios],
  [InstallPlace.settings]: [InstallState.prompt, InstallState.ios, InstallState.manual],
};

/** Offers to put the web app on the home screen. Takes `lang` because the language screen is outside I18nProvider. */
export function InstallCard({ place, lang }: { place: InstallPlace; lang: Lang }) {
  const state = useInstallState();
  const [hidden, setHidden] = useState(() => dismissed(place));
  if (hidden || !OFFERED[place].includes(state)) return null;

  function later() {
    dismiss(place);
    setHidden(true);
  }

  return (
    <section className={`${C.card} install`} lang={lang} aria-label={t(lang, "install.title")}>
      <span className="install-title">
        <Icon name="install" />
        {t(lang, "install.title")}
      </span>
      <span className={C.muted}>{t(lang, "install.about")}</span>
      {state === InstallState.prompt && (
        <button type={C.button} className={C.accent} onClick={() => void install()}>
          {t(lang, "install.button")}
        </button>
      )}
      {state === InstallState.ios && (
        <span className="install-step">
          <Icon name="share" />
          {t(lang, "install.ios")}
        </span>
      )}
      {state === InstallState.ios && place === InstallPlace.onboarding && (
        <span className="install-first">{t(lang, "install.ios_first")}</span>
      )}
      {state === InstallState.manual && <span className="install-step">{t(lang, "install.manual")}</span>}
      <button type={C.button} className={`${C.linkBtn} install-later`} onClick={later}>
        {t(lang, "install.later")}
      </button>
    </section>
  );
}
