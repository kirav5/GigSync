import type { MessageKey } from "@gigsync/core";
import { useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { InstallState, install, useInstallState } from "../adapters/install.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";

/** The install states the menu offers a button for; the app on the home screen, or the native one, needs none. */
const OFFERED: ReadonlySet<InstallState> = new Set([InstallState.prompt, InstallState.ios, InstallState.manual]);
/** The steps to say where the browser has no prompt to show. */
const STEPS: Partial<Record<InstallState, MessageKey>> = {
  [InstallState.ios]: "install.ios",
  [InstallState.manual]: "install.manual",
};

interface Props {
  account: Account;
  /** Opens About me, from the owner's name. */
  onAbout: () => void;
  onSignOut: () => void;
}

/**
 * The menu's foot, as collab's: who is signed in (their name opens About me), Sign out, and Install app until it is on
 * the home screen. Install shows Chrome's prompt where there is one; elsewhere it says the browser's own steps.
 */
export function SideFoot({ account, onAbout, onSignOut }: Props) {
  const { t } = useI18n();
  const state = useInstallState();
  const [steps, setSteps] = useState(false);
  const role = t(account.role === AccountRole.worker ? "role.worker" : "role.customer");
  const howTo = STEPS[state];

  const onInstall = () => {
    if (state === InstallState.prompt) void install();
    else setSteps((shown) => !shown);
  };

  return (
    <footer className="side-foot">
      <button type={C.button} className="linkish small" onClick={onAbout}>
        {account.contact.name} · {role} ›
      </button>
      <button type={C.button} className="side-btn quiet" onClick={onSignOut}>
        {t("shell.sign_out")}
      </button>
      {OFFERED.has(state) && (
        <button
          type={C.button}
          className="side-btn secondary"
          aria-expanded={howTo ? steps : undefined}
          onClick={onInstall}
        >
          <Icon name="install" size={16} />
          {t("install.button")}
        </button>
      )}
      {steps && howTo && <p className={C.muted}>{t(howTo)}</p>}
    </footer>
  );
}
