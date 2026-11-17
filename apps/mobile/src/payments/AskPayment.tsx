import { AskAgain, agreedPrice, type GigDevice, type JobRecord, type MessageKey, recurs } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { money } from "../ui/places.js";
import { Confirm } from "./Confirm.js";
import { K } from "./kit.js";
import { type Run, useStep } from "./useStep.js";
import { NeedUpi } from "./WorkerQr.js";

/** The ask button's words when the job was asked for before: after a dispute, or for a new month of monthly work. */
const ASK_AGAIN: Readonly<Record<AskAgain, MessageKey>> = {
  [AskAgain.dispute]: "money.ask_again",
  [AskAgain.month]: "money.ask_month",
};

interface Props {
  job: JobRecord;
  /** Set when this is not the first ask: after a dispute, or a month on. */
  again: AskAgain | undefined;
  /** What is due now, in paise: the price, what is left after an advance, or a month's pay. */
  due: number;
  /** The customer, as the reassurance under the buttons names them. */
  name: string;
  device: GigDevice;
  run: Run;
  onAddPayee: () => void;
}

/**
 * Nothing open: ask for what is due, with the amount on the button, or record that the customer already paid it in
 * cash, so the record stays complete. One-off work says it is done first; monthly work is asked for as it goes, so it
 * claims nothing about the work. The card under it is true of every payment here: UPI goes from the customer's bank
 * to the worker's, and GigSync takes no part of it (ADR 0011).
 */
export function AskPayment({ job, again, due, name, device, run, onAddPayee }: Props) {
  const { t } = useI18n();
  const { step, error, missing } = useStep(run);
  const [cash, setCash] = useState(false);
  const id = job.engagement.id;
  const hasPrice = job.mine !== undefined;
  const price = money(due);
  const left = due < agreedPrice(job);
  const ask = again ? t(ASK_AGAIN[again]) : t(left ? "money.ask_balance" : "money.ask_for", { price });
  return (
    <div className="worker-pay">
      {!recurs(job.request) && <p className="hero-title">{t("money.done_ask", { price })}</p>}
      {cash && hasPrice ? (
        <Confirm
          ask={t("money.cash_confirm", { price })}
          onAnswer={(yes) => {
            setCash(false);
            if (yes) step(() => device.recordCash(id));
          }}
        />
      ) : (
        <>
          <button
            type={C.button}
            className={K.big}
            onClick={() => step(() => device.requestPayment(id, job.request.need))}
          >
            <Icon name="rupee" size={20} />
            {ask}
          </button>
          {hasPrice && (
            <button type={C.button} className={C.secondary} onClick={() => setCash(true)}>
              {t("getpaid.cash")}
            </button>
          )}
        </>
      )}
      {missing && <NeedUpi onAddPayee={onAddPayee} />}
      {error && <p className={C.error}>{error}</p>}
      <div className={`${C.card} card-sage`}>
        <strong className="pay-straight">{t("money.straight", { name })}</strong>
        <p className={K.fine}>{t("money.no_cut")}</p>
      </div>
    </div>
  );
}
