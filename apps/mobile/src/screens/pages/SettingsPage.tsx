import type { MessageKey, Ports } from "@gigsync/core";
import { useState } from "react";
import { installOffered, useInstallState } from "../../adapters/install.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Look, savedLook, saveLook } from "../../ui/look.js";
import "../../ui/install.css";
import { ModelSettings } from "../ModelSettings.js";
import { SpeechSettings } from "../SpeechSettings.js";
import { TacticSetting } from "../TacticSetting.js";
import { PageFrame } from "./PageFrame.js";

const LOOKS: readonly { look: Look; label: MessageKey }[] = [
  { look: Look.auto, label: "look.auto" },
  { look: Look.light, label: "look.light" },
  { look: Look.dark, label: "look.dark" },
];

/** Light, dark, or the phone's own setting. */
function LookPicker() {
  const { t } = useI18n();
  const [look, setLook] = useState<Look>(savedLook());
  const title = t("settings.look");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <div className={C.row}>
        {LOOKS.map((l) => (
          <button
            key={l.look}
            type={C.button}
            aria-pressed={look === l.look}
            className={look === l.look ? C.chipOn : C.chip}
            onClick={() => {
              saveLook(l.look);
              setLook(l.look);
            }}
          >
            {t(l.label)}
          </button>
        ))}
      </div>
    </section>
  );
}

interface Props {
  ports: Ports;
  isWorker: boolean;
  /** Opens the Install screen. */
  onInstall: () => void;
}

/** The one way from Settings to the Install screen, until the app is on the home screen. */
function InstallRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const state = useInstallState();
  if (!installOffered(state)) return null;
  return (
    <button type={C.button} className={`${C.card} install-row`} onClick={onOpen}>
      <span className="install-badge" aria-hidden="true">
        <Icon name="install" size={18} />
      </span>
      <span className="install-text">
        <span className="install-title">{t("install.screen")}</span>
        <span className="install-about">{t("install.about")}</span>
      </span>
      <span className="install-go" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/**
 * Settings, as collab's: the look, voice actions (workers), the model on this phone, how the agent bargains, and
 * a row to the Install screen. Each saves as it changes, on this phone.
 */
export function SettingsPage({ ports, isWorker, onInstall }: Props) {
  const { t } = useI18n();
  return (
    <PageFrame title={t("page.settings_title")} subtitle={t("page.settings_soft")}>
      <LookPicker />
      {isWorker && <SpeechSettings />}
      <ModelSettings ports={ports} />
      <TacticSetting ports={ports} />
      <InstallRow onOpen={onInstall} />
    </PageFrame>
  );
}
