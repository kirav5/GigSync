import type { MessageKey, Ports } from "@gigsync/core";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard } from "../../ui/ListRow.js";
import { Look, savedLook, saveLook } from "../../ui/look.js";
import { AlertsSettings } from "../AlertsSettings.js";
import { SpeechSettings } from "../SpeechSettings.js";
import { AgentSection } from "./AgentSection.js";
import { ThisPhone } from "./ThisPhone.js";
import "./pages.css";

const LOOKS: readonly { look: Look; label: MessageKey }[] = [
  { look: Look.auto, label: "look.auto" },
  { look: Look.light, label: "look.light" },
  { look: Look.dark, label: "look.dark" },
];

/** Light, dark, or the phone's own setting: a group of its own, named by its label. */
function LookPicker() {
  const { t } = useI18n();
  const [look, setLook] = useState<Look>(savedLook());
  return (
    <ListCard label={t("settings.look")}>
      <div className={`${C.row} setting-block`}>
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
    </ListCard>
  );
}

interface Props {
  ports: Ports;
  /** The owner's account: its session tells the API where job alerts go; a worker's auto-sign is kept on it. */
  account: Account;
  isWorker: boolean;
  /** The account with a rule changed, saved here: the shell builds the agent again with it. */
  onSaved: (account: Account) => void;
  /** Opens the Install screen's steps, where the browser has no install prompt of its own to show. */
  onInstall: () => void;
  /** Opens Move to a new phone (this phone's code) and Moving from another phone (scan one). */
  onMoveOut: () => void;
  onMoveIn: () => void;
  /** Opens the Terms and Privacy Notice. */
  onTerms: () => void;
  /** Signs this owner out of this phone. */
  onSignOut: () => void;
}

/**
 * Settings (design P4), in four groups: the agent (signing deals, how it bargains, what runs it and the model on this
 * phone), alerts (job notifications, and the voice services a worker allowed), the look, and this phone (moving, Install,
 * the Terms, Sign out). Each saves as it changes, on this phone. Saved addresses are a household's own screen, from Me.
 */
export function SettingsPage(props: Props) {
  const { ports, account, isWorker, onSaved, ...phone } = props;
  return (
    <>
      <AgentSection ports={ports} account={account} isWorker={isWorker} onSaved={onSaved} />
      <AlertsSettings session={account.session} />
      {isWorker && <SpeechSettings />}
      <LookPicker />
      <ThisPhone {...phone} />
    </>
  );
}
