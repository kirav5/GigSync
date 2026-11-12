import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AddressHeader } from "./find/AddressHeader.js";
import { FindChat } from "./find/FindChat.js";
import { ModelNotice } from "./model/ModelNotice.js";
import "./talk.css";
import "./find/find.css";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

/**
 * Find workers near you for one need, then let your agent ask the ones you pick, as a conversation like Talk for
 * workers. A worker chosen first (their QR, their offer to work) is asked alone, in a chat of its own. The address in
 * use sits at the top, and a quiet card says what stays here: the budget, which workers' agents never see.
 */
export function Find({ ports, account, device, onAsked }: Props) {
  const { t } = useI18n();
  return (
    <>
      <div className={C.stack}>
        <AddressHeader storage={ports.storage} />
        <div className="card card-sage privacy-note" role="note">
          <strong>{t("find.soft")}</strong>
          <span className="fine">{t("find.private_line")}</span>
        </div>
      </div>
      <ModelNotice />
      <FindChat ports={ports} account={account} device={device} onAsked={onAsked} />
    </>
  );
}
