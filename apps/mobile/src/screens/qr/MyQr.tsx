import { log, type MessageKey, type Ports } from "@gigsync/core";
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
  ports: Ports;
  account: Account;
  /** A GigSync QR was scanned: open whoever it finds. */
  onScanned: (code: QrCode) => void;
  /** A worker's: shows their card below as households see it. */
  onSeeCard?: (() => void) | undefined;
}

/** "Make a new QR", quiet, and its one confirm: the old QR and its link stop finding the owner. */
function NewQr({ busy, onRenew }: { busy: boolean; onRenew: () => Promise<boolean> }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const label = t("qr.new");
  if (!confirming)
    return (
      <div className={C.row}>
        <button type={C.button} className={C.quiet} onClick={() => setConfirming(true)}>
          {label}
        </button>
      </div>
    );
  return (
    <div className={C.cardWait} role="dialog" aria-label={label}>
      <span>{t("qr.new_about")}</span>
      <div className={C.actions}>
        <button
          type={C.button}
          className={C.accent}
          disabled={busy}
          onClick={() => void onRenew().then((made) => made && setConfirming(false))}
        >
          {label}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => setConfirming(false)}>
          {t("qr.keep")}
        </button>
      </div>
    </div>
  );
}

/**
 * The owner's own QR, as collab's qr-card: the QR on a white tile (drawn at once from the code kept on this phone; a
 * blank tile the first time), and beside it what scanning does with Download, Copy link, Scan a QR and, for a worker,
 * their card as households see it. Anyone's phone camera opens the link; the app routes it after sign-in. Scanning
 * here asks for the camera only when tapped.
 */
export function MyQr({ ports, account, onScanned, onSeeCard }: Props) {
  const { t } = useI18n();
  const [qr, setQr] = useState<ShownQr>();
  const [status, setStatus] = useState<MessageKey>();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const isWorker = account.role === AccountRole.worker;
  const name = account.contact.name;

  useEffect(() => {
    let live = true;
    loadMyQr(account, ports.storage, (shown) => live && setQr(shown)).catch((err: unknown) => {
      log.warn("my qr not loaded", { error: err instanceof Error ? err.message : String(err) });
      if (live) setStatus(qrErrorKey(err));
    });
    return () => {
      live = false;
    };
  }, [account, ports]);

  const copy = async () => setStatus((await copyText(qr?.link ?? "")) ? "qr.copied" : "qr.copy_failed");
  const renew = async () => {
    setBusy(true);
    try {
      setQr(await replaceMyQr(account, ports.storage));
      setStatus("qr.new_done");
      return true;
    } catch (err) {
      setStatus(qrErrorKey(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={`${C.card} qr-card`} aria-label={t("qr.mine")}>
        {qr ? (
          <img className="qr" src={qr.image} alt={t("qr.alt", { name })} />
        ) : (
          <span className="qr qr-blank" aria-hidden="true" />
        )}
        <div className={C.stack}>
          <span className={C.labelSq}>{t("qr.mine")}</span>
          <span className={C.muted}>{t(isWorker ? "qr.about_worker" : "qr.about_household")}</span>
          <div className={C.row}>
            {qr && (
              <a className={C.secondaryCompact} download={QR_FILE} href={qr.image}>
                {t("qr.download")}
              </a>
            )}
            <button type={C.button} className={C.secondaryCompact} disabled={!qr} onClick={() => void copy()}>
              {t("qr.copy")}
            </button>
            <button type={C.button} className={C.accentCompact} onClick={() => setScanning(true)}>
              {t("qr.scan")}
            </button>
            {onSeeCard && (
              <button type={C.button} className={C.secondaryCompact} onClick={onSeeCard}>
                {t("page.see_card")}
              </button>
            )}
          </div>
          {qr && <NewQr busy={busy} onRenew={renew} />}
          <span className={C.faint} role="status" aria-live="polite">
            {status && t(status)}
          </span>
        </div>
      </section>
      {scanning && <QrScan onCode={onScanned} onClose={() => setScanning(false)} />}
    </>
  );
}
