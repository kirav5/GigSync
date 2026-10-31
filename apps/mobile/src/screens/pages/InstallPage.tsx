import type { MessageKey } from "@gigsync/core";
import { InstallDevice, InstallState, install, installDevice, useInstallState } from "../../adapters/install.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Logo } from "../../ui/Logo.js";
import "../../ui/install.css";

/** The card's headline: an iPhone, a phone, or a computer. */
const ON: Readonly<Record<InstallDevice, MessageKey>> = {
  [InstallDevice.iphoneSafari]: "install.on_iphone",
  [InstallDevice.iphoneOther]: "install.on_iphone",
  [InstallDevice.android]: "install.on_phone",
  [InstallDevice.macSafari]: "install.on_computer",
  [InstallDevice.computer]: "install.on_computer",
};

const IPHONE_REST: readonly MessageKey[] = ["install.ios_add", "install.ios_keep", "install.ios_open"];

/** The steps for each device and browser, as collab's Install panel says them. */
const STEPS: Readonly<Record<InstallDevice, readonly MessageKey[]>> = {
  [InstallDevice.iphoneSafari]: ["install.ios_share", ...IPHONE_REST],
  [InstallDevice.iphoneOther]: ["install.other_share", ...IPHONE_REST],
  [InstallDevice.android]: ["install.android_menu", "install.android_pick", "install.android_open"],
  [InstallDevice.macSafari]: ["install.mac_dock", "install.mac_add", "install.computer_open"],
  [InstallDevice.computer]: ["install.computer_icon", "install.computer_add", "install.computer_open"],
};

/** On an iPhone the first step is Share, so its icon leads it; and the home-screen app keeps its own data there. */
const IPHONE: ReadonlySet<InstallDevice> = new Set([InstallDevice.iphoneSafari, InstallDevice.iphoneOther]);

/**
 * Install GigSync, as collab's Install panel: the logo, where it goes and what it gives, then the steps for this device
 * and browser. Opened from the menu's Install app where the browser has no prompt of its own, and from Settings,
 * where Chrome's prompt (if it came after all) is the button above the steps. Already on the home screen: it says so.
 */
export function InstallPage() {
  const { t } = useI18n();
  const state = useInstallState();
  const device = installDevice();
  const installed = state === InstallState.installed || state === InstallState.native;
  const title = t("install.screen");
  return (
    <section className={`${C.card} install-card`} aria-label={title}>
      <div className="install-head">
        <Logo size={40} />
        <span className="install-text">
          <span className="install-title">{t(ON[device])}</span>
          <span className="install-about">{t(installed ? "install.installed" : "install.about")}</span>
        </span>
      </div>
      {state === InstallState.prompt && (
        <button type={C.button} className={C.accent} onClick={() => void install()}>
          <Icon name="install" size={16} />
          {t("install.button")}
        </button>
      )}
      {!installed && (
        <ol className="install-steps">
          {STEPS[device].map((key, i) => (
            <li key={key}>
              {i === 0 && IPHONE.has(device) && <Icon name="share" size={16} />}
              {t(key)}
            </li>
          ))}
        </ol>
      )}
      {!installed && IPHONE.has(device) && <p className="install-first">{t("install.ios_apart")}</p>}
    </section>
  );
}
