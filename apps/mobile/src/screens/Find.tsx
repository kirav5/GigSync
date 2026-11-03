import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AddressHeader } from "./find/AddressHeader.js";
import { FindChat } from "./find/FindChat.js";
import { ModelNotice } from "./model/ModelNotice.js";
import "./talk.css";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

/**
 * Find workers near you for one need, then let your agent ask the ones you pick, as a conversation like Talk for
 * workers. A worker chosen first (their QR, their offer to work) is asked alone, in a chat of its own. Your budget
 * stays here.
 */
export function Find({ ports, account, device, onAsked }: Props) {
  const { t } = useI18n();
  return (
    <>
      <div className={C.stack}>
        <AddressHeader storage={ports.storage} />
        <h1 className={C.headline}>
          {t("find.headline")} <span className={C.soft}>{t("find.soft")}</span>
        </h1>
      </div>
      <ModelNotice />
      <FindChat ports={ports} account={account} device={device} onAsked={onAsked} />
    </>
  );
}
