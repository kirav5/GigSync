import { type GigDevice, type JobRecord, log, ShareAnswer, SharePrices, shareDue } from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { errorKey } from "../../ui/errorKey.js";

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * On a job both sides signed, once: "Share this price anonymously to improve rate estimates?" with what would be sent
 * (ADR 0030 §3). Only for an owner whose setting is Ask each time; Always and Never are answered by the agent. Once
 * shared, a line says so.
 */
export function ShareCard({
  job,
  device,
  run,
}: {
  job: JobRecord;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<SharePrices>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const due = shareDue(job);

  useEffect(() => {
    if (!due) return;
    device
      .sharePrices()
      .then(setMode)
      .catch((err: unknown) => log.warn("loading the share setting failed", failure(err)));
  }, [device, due]);

  if (job.price_share === ShareAnswer.yes) return <span className={C.faint}>{t("estimate.shared")}</span>;
  if (!due || mode !== SharePrices.ask) return null;

  function answer(yes: boolean) {
    if (busy) return;
    setBusy(true);
    run(() => device.answerShare(job.engagement.id, yes))
      .then(() => setError(undefined))
      .catch((err: unknown) => {
        log.warn("answering the share card failed", failure(err));
        setError(t(errorKey(err)));
      })
      .finally(() => setBusy(false));
  }

  const ask = t("estimate.share_ask");
  return (
    <fieldset className={C.stack} aria-label={ask}>
      <span>{ask}</span>
      <span className={C.faint}>{t("estimate.share_what")}</span>
      <div className={C.row}>
        <button type={C.button} className={C.accent} disabled={busy} onClick={() => answer(true)}>
          {t("estimate.share_yes")}
        </button>
        <button type={C.button} className={C.secondary} disabled={busy} onClick={() => answer(false)}>
          {t("estimate.share_no")}
        </button>
      </div>
      {error && <span className={C.error}>{error}</span>}
    </fieldset>
  );
}
