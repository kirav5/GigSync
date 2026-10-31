import { type Account, AccountRole } from "../adapters/account.js";
import { InstallState, install, installOffered, useInstallState } from "../adapters/install.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";

interface Props {
  account: Account;
  /** Opens About me, from the owner's name. */
  onAbout: () => void;
  onSignOut: () => void;
  /** Opens the Install screen, where the browser has no prompt of its own to show. */
  onInstallSteps: () => void;
}

/**
 * The menu's foot, as collab's: who is signed in (their name opens About me), Sign out, and Install app until it is on
 * the home screen. Install shows Chrome's prompt where there is one; elsewhere it opens the Install screen's steps.
 */
export function SideFoot({ account, onAbout, onSignOut, onInstallSteps }: Props) {
  const { t } = useI18n();
  const state = useInstallState();
  const role = t(account.role === AccountRole.worker ? "role.worker" : "role.customer");

  const onInstall = () => {
    if (state === InstallState.prompt) void install();
    else onInstallSteps();
  };

  return (
    <footer className="side-foot">
      <button type={C.button} className="linkish small" onClick={onAbout}>
        {account.contact.name} · {role} ›
      </button>
      <button type={C.button} className="side-btn quiet" onClick={onSignOut}>
        {t("shell.sign_out")}
      </button>
      {installOffered(state) && (
        <button type={C.button} className="side-btn secondary" onClick={onInstall}>
          <Icon name="install" size={16} />
          {t("install.button")}
        </button>
      )}
    </footer>
  );
}
