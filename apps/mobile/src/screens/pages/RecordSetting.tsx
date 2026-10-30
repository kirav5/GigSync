import { log, type Ports, setShowsRecord, showsRecord } from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Privacy's "Show my record on my card" (ADR 0036), on until the worker turns it off. All of it or none: single
 * ratings cannot be hidden. The card goes to the board again with the choice after the next sync.
 */
export function RecordSetting({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const [shown, setShown] = useState<boolean>();

  useEffect(() => {
    showsRecord(ports.storage)
      .then(setShown)
      .catch((err: unknown) => log.warn("loading the record setting failed", failure(err)));
  }, [ports]);

  function choose(show: boolean) {
    setShowsRecord(ports.storage, show)
      .then(() => setShown(show))
      .catch((err: unknown) => log.warn("saving the record setting failed", failure(err)));
  }

  const label = t("record.setting");
  return (
    <section className={C.card} aria-label={label}>
      <label className={C.checkRow}>
        <input
          type="checkbox"
          role="switch"
          aria-checked={shown ?? true}
          checked={shown ?? true}
          disabled={shown === undefined}
          onChange={(e) => choose(e.currentTarget.checked)}
        />
        <span>{label}</span>
      </label>
      <span className={C.muted}>{t("record.setting_about")}</span>
    </section>
  );
}
