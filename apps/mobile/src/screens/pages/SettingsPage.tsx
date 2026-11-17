import type { Account } from "../../adapters/account.js";
import { AlertsSettings } from "../AlertsSettings.js";
import { SpeechSettings } from "../SpeechSettings.js";
import { ThisPhone } from "./ThisPhone.js";
import "./pages.css";

interface Props {
  /** The owner's account: its session tells the API where job alerts go. */
  account: Account;
  isWorker: boolean;
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
 * Settings (design P4): alerts (job notifications, and the voice services a worker allowed), and this phone (moving,
 * Install, the Terms, Sign out). Nothing about the assistant is a setting: it always asks before signing a deal and
 * bargains at its usual pace. There is no look to pick: GigSync is light only. Each saves as it changes, on this phone.
 * Saved addresses are a household's own screen, from Me.
 */
export function SettingsPage(props: Props) {
  const { account, isWorker, ...phone } = props;
  return (
    <>
      <AlertsSettings session={account.session} />
      {isWorker && <SpeechSettings />}
      <ThisPhone {...phone} />
    </>
  );
}
