import { asciiDigits, type GigDevice, UPI_APP_NAME, UpiApp, upiAppLink } from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { payInChooser, UpiOpen, upiOpen } from "../adapters/upi.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { money } from "../ui/places.js";
import { Working } from "../ui/Working.js";
import { qrDataUrl } from "./qr.js";
import type { Step } from "./useStep.js";

const UPI_APPS = Object.keys(UpiApp) as UpiApp[];
/** The words on the one button, and the name of the row of buttons. */
const OPEN_UPI = "job.open_upi";

/**
 * Where the household picks their UPI app: Android's chooser in the app; in a browser on Android, a button per common
 * app and one for any other (the phone's default); elsewhere the plain link. When the chooser fails, the plain link.
 */
function UpiButtons({ link }: { link: string }) {
  const { t } = useI18n();
  const [way, setWay] = useState(upiOpen);
  if (way === UpiOpen.chooser) {
    const choose = async () => {
      if (!(await payInChooser(link, t("job.upi_choose")))) setWay(UpiOpen.link);
    };
    return (
      <button type={C.button} className={C.secondary} onClick={() => void choose()}>
        {t(OPEN_UPI)}
      </button>
    );
  }
  if (way === UpiOpen.link) {
    return (
      <a className={C.secondary} href={link}>
        {t(OPEN_UPI)}
      </a>
    );
  }
  return (
    <nav className={C.row} aria-label={t(OPEN_UPI)}>
      {UPI_APPS.map((app) => (
        <a key={app} className={C.secondaryCompact} href={upiAppLink(link, app)}>
          {UPI_APP_NAME[app]}
        </a>
      ))}
      <a className={C.secondaryCompact} href={link}>
        {t("job.upi_other")}
      </a>
    </nav>
  );
}

/**
 * The consumer pays in their own UPI app; GigSync only shows the QR and records the reference they paste back. When
 * the link cannot be built (this phone never got the worker's sealed payment request) it says so instead of a dead QR.
 */
export function PayBox({ payment, device, step }: { payment: Payment; device: GigDevice; step: Step }) {
  const { t } = useI18n();
  const [link, setLink] = useState<string>();
  const [qr, setQr] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void (async () => {
      try {
        const l = await device.upiLink(payment.id);
        const image = await qrDataUrl(l);
        if (!live) return;
        setLink(l);
        setQr(image);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [device, payment.id]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const utr = asciiDigits(String(new FormData(e.currentTarget).get("utr") ?? "").trim());
    step(() => device.markPaid(payment.id, utr || undefined));
  }
  return (
    <form className={C.stack} onSubmit={submit} aria-label={t("a11y.pay")}>
      <span className={C.label}>
        {t(payment.advance ? "job.pay_advance" : "job.pay_by_upi", { price: money(payment.amount_paise) })}
      </span>
      {failed && <p className={C.error}>{t("error.generic")}</p>}
      <Working on={!qr && !failed} />
      {qr && <img src={qr} alt={t("a11y.qr")} width={160} height={160} />}
      {link && <UpiButtons link={link} />}
      <input
        className={C.field}
        name="utr"
        aria-label={t("a11y.utr")}
        placeholder={t("job.utr_placeholder")}
        inputMode="numeric"
      />
      <div className={C.actions}>
        <button type={C.submit} className={C.accent}>
          {t("job.paid")}
        </button>
      </div>
    </form>
  );
}
