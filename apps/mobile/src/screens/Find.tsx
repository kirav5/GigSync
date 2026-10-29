import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { FindMode, setFindMode, useNeed } from "../find/needStore.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { SiteForm } from "./colleague/SiteForm.js";
import { FindChat } from "./find/FindChat.js";
import { FindForm } from "./find/FindForm.js";
import "./talk.css";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
  /** A worker hiring a helper for their own work (round2-spec §3.3 A), opened from Talk. */
  hire?: boolean;
  /** The account after the work site was saved. */
  onAccount: (a: Account) => void;
}

/**
 * Find workers near you for one need, then let your agent ask the ones you pick. It opens as a conversation, like Talk
 * for workers; the form is a tap away for those who prefer it. Your budget stays here. A worker hiring is asked first
 * where the work is, if their card has no address; their own card never shows.
 */
export function Find({ ports, account, device, onAsked, hire = false, onAccount }: Props) {
  const { t } = useI18n();
  const { mode } = useNeed();
  if (hire && !account.contact.address) return <SiteForm ports={ports} account={account} ask onSaved={onAccount} />;
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
        {hire ? (
          <h1 className={C.headline}>{t("hire.title")}</h1>
        ) : (
          <h1 className={C.headline}>
            {t("find.headline")} <span className={C.soft}>{t("find.soft")}</span>
          </h1>
        )}
      </div>
      {chat ? (
        <FindChat ports={ports} account={account} device={device} hire={hire} onAsked={onAsked} />
      ) : (
        <FindForm ports={ports} account={account} device={device} onAsked={onAsked} />
      )}
    </>
  );
}
