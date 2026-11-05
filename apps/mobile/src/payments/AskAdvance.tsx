import { advanceCap, asciiDigits, type GigDevice, type JobRecord } from "@gigsync/core";
import { PAISE_PER_RUPEE } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { type Run, useStep } from "./useStep.js";
import { NeedUpi } from "./WorkerQr.js";

const AMOUNT_FIELD = "amount";

interface Props {
  job: JobRecord;
  device: GigDevice;
  run: Run;
  onAddPayee: () => void;
}

/**
 * Before the work is done, the one money move a worker has on a one-off job: part of the price, up to the limit
 * (ADR 0054). Shown only when the other phone takes part of the price; otherwise the worker asks once it is done.
 */
export function AskAdvance({ job, device, run, onAddPayee }: Props) {
  const { t } = useI18n();
  const { step, error, missing } = useStep(run);
  const [takes, setTakes] = useState(false);
  const [asking, setAsking] = useState(false);
  const [tooMuch, setTooMuch] = useState(false);
  const id = job.engagement.id;
  const cap = advanceCap(job);
  const label = t("money.ask_advance");
  useEffect(() => {
    let live = true;
    void device
      .takesAdvance(id)
      .then((yes) => live && setTakes(yes))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [device, id]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rupees = Number(asciiDigits(String(new FormData(e.currentTarget).get(AMOUNT_FIELD) ?? "").trim()));
    const paise = rupees * PAISE_PER_RUPEE;
    const fits = paise > 0 && paise <= cap;
    setTooMuch(!fits);
    if (fits) step(() => device.requestAdvance(id, paise, job.request.need));
  }
  if (!takes || cap === 0) return null;
  if (!asking)
    return (
      <div className={C.actions}>
        <button type={C.button} className={C.secondary} onClick={() => setAsking(true)}>
          {label}
        </button>
      </div>
    );
  return (
    <form className={C.stack} onSubmit={submit} aria-label={label}>
      <span className={C.label}>{t("money.advance_cap", { price: money(cap) })}</span>
      <input
        className={C.field}
        name={AMOUNT_FIELD}
        aria-label={t("money.advance_amount")}
        placeholder={t("money.advance_amount")}
        inputMode="numeric"
      />
      <div className={C.actions}>
        <button type={C.submit} className={C.accent}>
          {label}
        </button>
      </div>
      {tooMuch && <p className={C.error}>{t("money.advance_cap", { price: money(cap) })}</p>}
      {missing && <NeedUpi onAddPayee={onAddPayee} />}
      {error && <p className={C.error}>{error}</p>}
    </form>
  );
}
