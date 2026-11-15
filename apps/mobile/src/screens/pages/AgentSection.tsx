import { log, type Ports } from "@gigsync/core";
import { useState } from "react";
import { type Account, saveAccount } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ListCard } from "../../ui/ListRow.js";
import { TacticSetting } from "../TacticSetting.js";
import { ToggleRow } from "./ToggleRow.js";

interface Props {
  ports: Ports;
  account: Account;
  /** The account with a rule changed, saved: the shell builds the agent again with it. */
  onSaved: (account: Account) => void;
}

/**
 * "Sign deals for me": the agent signs a deal it reached inside the worker's prices without asking (core's
 * auto-confirm), the same choice as the card form's box. It is kept on this phone with the account; nothing is published.
 */
function AutoSign({ ports, account, onSaved }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function choose(on: boolean) {
    const next: Account = { ...account, autoConfirm: on };
    setBusy(true);
    setFailed(false);
    saveAccount(ports, next)
      .then(() => onSaved(next))
      .catch((err: unknown) => {
        setFailed(true);
        log.warn("saving auto-sign failed", { error: err instanceof Error ? err.name : typeof err });
      })
      .finally(() => setBusy(false));
  }

  const sub = failed ? (
    <span className={C.error} role="alert">
      {t("me.auto_sign_failed")}
    </span>
  ) : (
    t("me.auto_sign_sub")
  );
  return (
    <ToggleRow
      title={t("me.auto_sign")}
      sub={sub}
      checked={account.autoConfirm === true}
      onChange={choose}
      disabled={busy}
    />
  );
}

/**
 * Settings' "Your agent" (design P4): signing deals without asking (workers, whose card form has the same box), how it
 * bargains (ADR 0033). The design's "Ask me before quoting" and "Take jobs on
 * my day off" are not here: the first is no rule the agent has, and the days a worker works are on their card.
 */
export function AgentSection({ ports, account, onSaved, isWorker }: Props & { isWorker: boolean }) {
  const { t } = useI18n();
  return (
    <ListCard label={t("me.section_agent")}>
      {isWorker && <AutoSign ports={ports} account={account} onSaved={onSaved} />}
      <TacticSetting ports={ports} />
    </ListCard>
  );
}
