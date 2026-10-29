import {
  log,
  type MessageKey,
  type Ports,
  SHARE_PRICES_OPTIONS,
  SharePrices,
  setSharePrices,
  sharePrices,
} from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const LABEL: Readonly<Record<SharePrices, MessageKey>> = {
  [SharePrices.ask]: "estimate.setting_ask",
  [SharePrices.always]: "estimate.setting_always",
  [SharePrices.never]: "estimate.setting_never",
};

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Profile's "Share agreed prices anonymously to improve rate estimates: Ask each time / Always share / Never". Ask each
 * time (the default) shows a card on each job both sides signed; what is sent is said on that card.
 */
export function ShareSetting({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<SharePrices>();

  useEffect(() => {
    sharePrices(ports.storage)
      .then(setMode)
      .catch((err: unknown) => log.warn("loading the share setting failed", failure(err)));
  }, [ports]);

  function choose(next: SharePrices) {
    setSharePrices(ports.storage, next)
      .then(() => setMode(next))
      .catch((err: unknown) => log.warn("saving the share setting failed", failure(err)));
  }

  const label = t("estimate.setting_label");
  return (
    <section className={C.card} aria-label={label}>
      <span className={C.label}>{label}</span>
      <span className={C.muted}>{t("estimate.share_what")}</span>
      <div className={C.row}>
        {SHARE_PRICES_OPTIONS.map((m) => (
          <button
            key={m}
            type={C.button}
            aria-pressed={mode === m}
            className={mode === m ? C.chipOn : C.chip}
            onClick={() => choose(m)}
          >
            {t(LABEL[m])}
          </button>
        ))}
      </div>
    </section>
  );
}
