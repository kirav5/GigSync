import type { Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { AlertsSettings } from "../AlertsSettings.js";
import { SpeechSettings } from "../SpeechSettings.js";
import { AgentSection } from "./AgentSection.js";
import { ThisPhone } from "./ThisPhone.js";
import "./pages.css";

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
 * Settings (design P4), in three groups: the agent (signing deals, how it bargains, what runs it and the model on this
 * phone), alerts (job notifications, and the voice services a worker allowed), and this phone (moving, Install, the
 * Terms, Sign out). There is no look to pick: GigSync is light only. Each saves as it changes, on this phone. Saved addresses are a household's own screen, from Me.
 */
export function SettingsPage(props: Props) {
  const { ports, account, isWorker, onSaved, ...phone } = props;
  return (
    <>
      <AgentSection ports={ports} account={account} isWorker={isWorker} onSaved={onSaved} />
      <AlertsSettings session={account.session} />
      {isWorker && <SpeechSettings />}
      <ThisPhone {...phone} />
    </>
  );
}
