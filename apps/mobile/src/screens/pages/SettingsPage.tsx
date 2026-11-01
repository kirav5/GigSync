import type { MessageKey, Ports } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import { useState } from "react";
import { installOffered, useInstallState } from "../../adapters/install.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Look, savedLook, saveLook } from "../../ui/look.js";
import "../../ui/install.css";
import { AlertsSettings } from "../AlertsSettings.js";
import { ModelSettings } from "../ModelSettings.js";
import { MoveRows, SettingsRow } from "../move/MoveRows.js";
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
  /** The signed-in device's session: job alerts tell the API where this device takes pushes. */
  session: Session;
  isWorker: boolean;
  /** Opens the Install screen. */
  onInstall: () => void;
  /** Opens Move to a new phone (this phone's code) and Moving from another phone (scan one). */
  onMoveOut: () => void;
  onMoveIn: () => void;
  /** Opens the Terms and Privacy Notice. */
  onTerms: () => void;
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
 * Settings, as collab's: the look, job alerts, voice actions (workers), the model on this phone, how the agent bargains, a row
 * to the Install screen, the two ways of moving between phones, and the Terms and Privacy Notice. Each saves as it
 * changes, on this phone.
 */
export function SettingsPage({ ports, session, isWorker, onInstall, onMoveOut, onMoveIn, onTerms }: Props) {
  const { t } = useI18n();
  return (
    <PageFrame title={t("page.settings_title")} subtitle={t("page.settings_soft")}>
      <LookPicker />
      <AlertsSettings session={session} />
      {isWorker && <SpeechSettings />}
      <ModelSettings ports={ports} />
      <TacticSetting ports={ports} />
      <InstallRow onOpen={onInstall} />
      <MoveRows onMoveOut={onMoveOut} onMoveIn={onMoveIn} />
      <SettingsRow icon="shield" title="records.terms_title" about="records.terms_about" onOpen={onTerms} />
    </PageFrame>
  );
}
