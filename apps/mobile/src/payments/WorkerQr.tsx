import { type GigDevice, log, PayeeMissingError } from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { payeeIn } from "./payer.js";
import { qrDataUrl } from "./qr.js";
import "./money.css";

interface Shown {
  qr: string;
  vpa: string;
  name: string;
}

/**
 * The worker's own UPI QR for an open payment, drawn on this phone from the UPI ID saved in About me, for a customer
 * standing in front of them to scan.
 */
export function WorkerQr({
  device,
  payment,
  onAddPayee,
}: {
  device: GigDevice;
  payment: Payment;
  onAddPayee: () => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState<Shown>();
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const link = await device.myUpiLink(payment.id);
        const qr = await qrDataUrl(link);
        if (live) setShown({ qr, ...payeeIn(link) });
      } catch (err) {
        if (!live) return;
        if (err instanceof PayeeMissingError) return setMissing(true);
        log.warn("worker QR failed", { error: err instanceof Error ? err.message : String(err) });
        setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [device, payment.id]);

  if (missing) return <NeedUpi onAddPayee={onAddPayee} />;
  if (failed) return <p className={C.error}>{t("error.generic")}</p>;
  if (!shown) return null;
  const price = money(payment.amount_paise);
  return (
    <div className={`${C.card} worker-qr`}>
      <span className={C.labelSq}>{t("getpaid.scan")}</span>
      <img src={shown.qr} alt={t("getpaid.qr_alt", { price, vpa: shown.vpa })} />
      <span className="amount">{price}</span>
      <span className={C.muted}>{t("getpaid.to", { name: shown.name, vpa: shown.vpa })}</span>
      <span className={C.faint}>{t("getpaid.scan_about")}</span>
    </div>
  );
}

/** No UPI ID saved: say where to add it, with a button that goes there. */
export function NeedUpi({ onAddPayee }: { onAddPayee: () => void }) {
  const { t } = useI18n();
  return (
    <div className={C.cardWait}>
      <p className={C.muted} role="status">
        {t("money.need_upi")}
      </p>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onAddPayee}>
          {t("money.add_upi")}
        </button>
      </div>
    </div>
  );
}
