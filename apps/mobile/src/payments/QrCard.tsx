import type { GigDevice } from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { useId, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { WorkerQr } from "./WorkerQr.js";

interface Props {
  device: GigDevice;
  payment: Payment;
  /** The customer, as the line under the row names them. */
  name: string;
  onAddPayee: () => void;
}

/**
 * "Show my QR" as a row in its own card, for a customer standing in front of the worker: while the request waits, and
 * after the customer says they paid, since they may still rather scan. The QR opens under the row and closes again;
 * the row's name is its title alone, so it reads the same whatever the line under it says.
 */
export function QrCard({ device, payment, name, onAddPayee }: Props) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const id = useId();
  const titleId = `${id}t`;
  const subId = `${id}s`;
  return (
    <div className={`${C.card} qr-card`}>
      <button
        type={C.button}
        className="list-row"
        aria-expanded={shown}
        aria-labelledby={titleId}
        aria-describedby={subId}
        onClick={() => setShown(!shown)}
      >
        <span className="list-row-icon">
          <Icon name="qr" size={20} />
        </span>
        <span className="list-row-text">
          <span id={titleId} className="list-row-title">
            {t(shown ? "money.hide_qr" : "money.show_qr")}
          </span>
          <span id={subId} className="list-row-sub">
            {t("money.qr_sub", { name })}
          </span>
        </span>
      </button>
      {shown && <WorkerQr device={device} payment={payment} onAddPayee={onAddPayee} />}
    </div>
  );
}
