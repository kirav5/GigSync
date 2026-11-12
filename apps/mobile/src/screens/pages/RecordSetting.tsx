import { log, type Ports } from "@gigsync/core";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { setShowRecord } from "../../card/publish.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { ToggleRow } from "./ToggleRow.js";

/** A status line under the switch's own words. */
const NOTE = "row-note";

/**
 * Privacy's "Show my record on my card" (ADR 0036 §3, ADR 0038), a switch row: on until the worker turns it off, kept
 * by GigSync with the card. All of it or none: single ratings cannot be hidden. Without a card on the board there is
 * nothing to show it on, so the switch waits for one.
 */
export function RecordSetting({ ports, account }: { ports: Ports; account: Account }) {
  const { t } = useI18n();
  const { card, keep } = useOwnCard(ports, account);
  /** The choice on its way to GigSync: shown at once, and undone if it does not arrive. */
  const [sending, setSending] = useState<boolean>();
  const [failed, setFailed] = useState(false);

  function choose(show: boolean) {
    setSending(show);
    setFailed(false);
    setShowRecord(ports, account, show)
      .then(keep)
      .catch((err: unknown) => {
        setFailed(true);
        log.warn("changing the record setting failed", { error: err instanceof Error ? err.name : typeof err });
      })
      .finally(() => setSending(undefined));
  }

  const sub = (
    <>
      {t("record.setting_about")}
      {card === null && <span className={NOTE}>{t("records.show_needs_card")}</span>}
      {failed && (
        <span className={`${NOTE} ${C.error}`} role="alert">
          {t("records.show_failed")}
        </span>
      )}
    </>
  );
  return (
    <ToggleRow
      title={t("record.setting")}
      sub={sub}
      checked={sending ?? card?.show_record ?? true}
      onChange={choose}
      disabled={!card || sending !== undefined}
    />
  );
}
