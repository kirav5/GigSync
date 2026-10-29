import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { FindMode, setFindMode, useNeed } from "../find/needStore.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { FindChat } from "./find/FindChat.js";
import { FindForm } from "./find/FindForm.js";
import "./talk.css";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

/**
 * Find workers near you for one need, then let your agent ask the ones you pick. It opens as a conversation, like Talk
 * for workers; the form is a tap away for those who prefer it. Your budget stays here.
 */
export function Find({ ports, account, device, onAsked }: Props) {
  const { t } = useI18n();
  const { mode } = useNeed();
  const chat = mode === FindMode.chat;
  return (
    <>
      <div className={C.stack}>
        <div className={`${C.row} talk-head`}>
          <span className={C.labelSq}>{t("nav.find")}</span>
          <button type={C.button} className={C.quiet} onClick={() => setFindMode(chat ? FindMode.form : FindMode.chat)}>
            {t(chat ? "need.use_form" : "need.use_chat")}
          </button>
        </div>
        <h1 className={C.headline}>
          {t("find.headline")} <span className={C.soft}>{t("find.soft")}</span>
        </h1>
      </div>
      {chat ? (
        <FindChat ports={ports} account={account} device={device} onAsked={onAsked} />
      ) : (
        <FindForm ports={ports} account={account} device={device} onAsked={onAsked} />
      )}
    </>
  );
}
