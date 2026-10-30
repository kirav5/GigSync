import { log, type Ports } from "@gigsync/core";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { setShowRecord } from "../../card/publish.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * Privacy's "Show my record on my card" (ADR 0036 §3, ADR 0038): on until the worker turns it off, kept by GigSync
 * with the card. All of it or none: single ratings cannot be hidden. Without a card on the board there is nothing to
 * show it on, so the switch waits for one.
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

  const label = t("record.setting");
  const shown = sending ?? card?.show_record ?? true;
  return (
    <section className={C.card} aria-label={label}>
      <label className={C.checkRow}>
        <input
          type="checkbox"
          role="switch"
          aria-checked={shown}
          checked={shown}
          disabled={!card || sending !== undefined}
          onChange={(e) => choose(e.currentTarget.checked)}
        />
        <span>{label}</span>
      </label>
      <span className={C.muted}>{t("record.setting_about")}</span>
      {card === null && <span className={C.faint}>{t("records.show_needs_card")}</span>}
      {failed && (
        <span className={C.error} role="alert">
          {t("records.show_failed")}
        </span>
      )}
    </section>
  );
}
