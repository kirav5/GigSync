import { log, type MessageKey } from "@gigsync/core";
import type { QrCode } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { copyText } from "../../adapters/clipboard.js";
import { useI18n } from "../../i18n.js";
import { loadMyQr, QR_FILE, replaceMyQr, type ShownQr } from "../../qr/myQr.js";
import { qrErrorKey } from "../../qr/problems.js";
import { C } from "../../ui/cls.js";
import { QrScan } from "./QrScan.js";
import "./qr.css";

interface Props {
  account: Account;
  /** A GigSync QR was scanned: open whoever it finds. */
  onScanned: (code: QrCode) => void;
}

/**
 * The owner's own QR, as collab's card: the QR (a link with a code the server maps to them), their name and role, and
 * Download, Copy link, Scan a QR and Make a new QR. Anyone's phone camera opens the link; the app routes it after
 * sign-in. Scanning here asks for the camera only when tapped.
 */
export function MyQr({ account, onScanned }: Props) {
  const { t } = useI18n();
  const [qr, setQr] = useState<ShownQr>();
  const [status, setStatus] = useState<MessageKey>();
  const [confirming, setConfirming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const isWorker = account.role === AccountRole.worker;
  const name = account.contact.name;
  const newLabel = t("qr.new");

  useEffect(() => {
    let live = true;
    loadMyQr(account)
      .then((shown) => live && setQr(shown))
      .catch((err: unknown) => {
        log.warn("my qr not loaded", { error: err instanceof Error ? err.message : String(err) });
        if (live) setStatus(qrErrorKey(err));
      });
    return () => {
      live = false;
    };
  }, [account]);

  const copy = async () => setStatus((await copyText(qr?.link ?? "")) ? "qr.copied" : "qr.copy_failed");
  const renew = async () => {
    setBusy(true);
    try {
      setQr(await replaceMyQr(account));
      setStatus("qr.new_done");
      setConfirming(false);
    } catch (err) {
      setStatus(qrErrorKey(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={`${C.card} qr-card`} aria-label={t("qr.mine")}>
        {qr && <img className="qr" src={qr.image} alt={t("qr.alt", { name })} />}
        <div className={C.stack}>
          <span className={C.labelSq}>{t("qr.mine")}</span>
          <strong>{name}</strong>
          <span className={C.muted}>{t(isWorker ? "role.worker" : "qr.household")}</span>
          <span className={C.muted}>{t(isWorker ? "qr.about_worker" : "qr.about_household")}</span>
          {qr && (
            <div className={C.row}>
              <a className={C.secondaryCompact} download={QR_FILE} href={qr.image}>
                {t("qr.download")}
              </a>
              <button type={C.button} className={C.secondaryCompact} onClick={() => void copy()}>
                {t("qr.copy")}
              </button>
              <button type={C.button} className={C.accentCompact} onClick={() => setScanning(true)}>
                {t("qr.scan")}
              </button>
              <button type={C.button} className={C.secondaryCompact} onClick={() => setConfirming(true)}>
                {newLabel}
              </button>
            </div>
          )}
          {confirming && (
            <div className={C.cardWait} role="dialog" aria-label={newLabel}>
              <span>{t("qr.new_about")}</span>
              <div className={C.actions}>
                <button type={C.button} className={C.accent} disabled={busy} onClick={() => void renew()}>
                  {newLabel}
                </button>
                <button type={C.button} className={C.secondary} onClick={() => setConfirming(false)}>
                  {t("qr.keep")}
                </button>
              </div>
            </div>
          )}
          <span className={C.faint} role="status" aria-live="polite">
            {status && t(status)}
          </span>
        </div>
      </section>
      {scanning && <QrScan onCode={onScanned} onClose={() => setScanning(false)} />}
    </>
  );
}
