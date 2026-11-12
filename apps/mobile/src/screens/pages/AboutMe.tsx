import type { Ports } from "@gigsync/core";
import { PAYEE_NAME_MAX } from "@gigsync/protocol";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { PayeeForm } from "../../payments/PayeeForm.js";
import { Avatar, AvatarSize } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { Icon } from "../../ui/Icon.js";
import { MemorySection } from "../memory/MemorySection.js";
import { AboutFields } from "./AboutFields.js";
import { LanguagePicker } from "./LanguagePicker.js";
import "./pages.css";

interface Props {
  ports: Ports;
  account: Account;
  isWorker: boolean;
  /** Opens the worker's card as a form, where work, area and languages are changed. */
  onEditCard: () => void;
  /** Opens Talk on the card interview: the worker changes their card by saying it (ADR 0053 §7). */
  onTalk: () => void;
}

/**
 * About me (design P2): who the owner is, then for a worker their work, area and languages as fields that open the
 * card's form, and where they are paid (the UPI ID, asked for nowhere else); then the language and what their agent
 * remembers, for both sides. The name is shown, not edited: it is on the board card and the QR, so changing it here
 * would need the card published again. A worker's one big action is changing the card by talking.
 */
export function AboutMe({ ports, account, isWorker, onEditCard, onTalk }: Props) {
  const { t } = useI18n();
  const name = account.contact.name;
  return (
    <>
      <div className="about-head">
        <Avatar name={name} size={AvatarSize.xl} />
        <h1 className="hero-title">{name}</h1>
      </div>
      {isWorker && <AboutFields account={account} onEditCard={onEditCard} />}
      {isWorker && <PayeeForm ports={ports} defaultName={name.slice(0, PAYEE_NAME_MAX)} />}
      <LanguagePicker />
      <MemorySection ports={ports} account={account} />
      {isWorker && (
        <Dock>
          <button type={C.button} className={`${C.wide} btn-big`} onClick={onTalk}>
            <Icon name="mic" size={20} />
            {t("card.change_by_talking")}
          </button>
        </Dock>
      )}
    </>
  );
}
