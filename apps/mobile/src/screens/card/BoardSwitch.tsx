import { log, type Ports } from "@gigsync/core";
import { useEffect, useId, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { offerAlerts } from "../../adapters/push.js";
import { closeInterview } from "../../card/interviewStore.js";
import { AboutPrivateError, accountDraft, publishCard, unlistCard } from "../../card/publish.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { errorKey } from "../../ui/errorKey.js";
import { Toggle } from "../../ui/Toggle.js";
import "./card.css";

interface Props {
  ports: Ports;
  /** A worker with a card made: this switch puts that card on the board or takes it off. */
  account: Account;
  /** The account as it is after the card went on or came off the board. */
  onSaved?: ((a: Account) => void) | undefined;
}

/**
 * "My card is on the board" (W6), for a worker who has made a card. Off is asked once more, as the chat asks it
 * (ADR 0053 §7): new households stop finding them until it is back, and their jobs stay as they are. On puts the card
 * this phone holds back on the board as it was. Both are the same calls the chat and the My card form make.
 */
export function BoardSwitch({ ports, account, onSaved }: Props) {
  const { lang, t } = useI18n();
  const [listed, setListed] = useState(account.listed !== false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const askId = useId();

  // The chat or the form can put the card on or off the board too: the switch follows the account.
  useEffect(() => setListed(account.listed !== false), [account.listed]);

  async function put(on: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      // A listed card is when requests start to come: the browser may ask about notifications, once.
      if (on) void offerAlerts();
      const next = on
        ? await publishCard(ports, account, accountDraft(account), lang)
        : await unlistCard(ports, account);
      // A card interview left half-way would carry on from the card as it was, and could publish that over this.
      closeInterview();
      setListed(on);
      setAsking(false);
      setError(undefined);
      onSaved?.(next);
    } catch (err) {
      log.warn("board switch failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(err instanceof AboutPrivateError ? "iv.err_private" : errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  const label = t("cardflow.on_board");
  return (
    <div className="board-switch">
      <div className="board-switch-row">
        <Toggle
          checked={listed}
          label={label}
          disabled={busy || asking}
          onChange={(on) => (on ? void put(true) : setAsking(true))}
        />
        {/* The switch is named by these words already; said twice, a reader would hear them twice. */}
        <span aria-hidden="true">{label}</span>
      </div>
      {asking && (
        <div className={`${C.cardWait} qr-confirm`} role="dialog" aria-labelledby={askId}>
          <span id={askId}>{t("iv.ask.unlist")}</span>
          <div className={C.actions}>
            <button
              type={C.button}
              className={C.danger}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void put(false)}
            >
              {t("card.unlist")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setAsking(false)}>
              {t("cardflow.keep_on")}
            </button>
          </div>
        </div>
      )}
      <p className={error ? C.error : "fine"} role="status" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
