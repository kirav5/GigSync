import type { Ports } from "@gigsync/core";
import type { QrCode } from "@gigsync/protocol";
import { type ReactNode, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { QR_FILE } from "../../qr/myQr.js";
import { type ShareWords, useMyQr } from "../../qr/useMyQr.js";
import { C } from "../../ui/cls.js";
import { QrScan } from "./QrScan.js";
import "./qr.css";

interface Props {
  ports: Ports;
  account: Account;
  /** The card's name for screen readers. */
  label: string;
  /** Above the QR: who the owner is, as others see them. */
  children: ReactNode;
  /** Under the QR: what scanning it does. */
  scanLine: string;
  /** What the share sheet says with the link. */
  share: ShareWords;
  /** A GigSync QR was scanned: open whoever it finds. */
  onScanned: (code: QrCode) => void;
}

/** "Make a new QR", quiet, and its one confirm: the old QR and its link stop finding the owner. */
function NewQr({ busy, onRenew }: { busy: boolean; onRenew: () => Promise<boolean> }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const label = t("qr.new");
  if (!confirming)
    return (
      <button type={C.button} className={C.quiet} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  return (
    <div className={`${C.cardWait} qr-confirm`} role="dialog" aria-label={label}>
      <span>{t("qr.new_about")}</span>
      <div className={C.actions}>
        <button
          type={C.button}
          className={C.accent}
          disabled={busy}
          aria-busy={busy}
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
 * My card's one card, as collab's: who the owner is (`children`), then the QR on a white tile (drawn at once from the code kept on this
 * phone; a blank tile the first time), what scanning it does, then Share, Copy link and Save QR, and quieter, Scan a
 * QR and Make a new QR. Anyone's phone camera opens the link; the app routes it after sign-in. Scanning here asks for
 * the camera only when tapped.
 */
export function MyQr({ ports, account, label, children, scanLine, share, onScanned }: Props) {
  const { t } = useI18n();
  const mine = useMyQr(ports, account);
  const [scanning, setScanning] = useState(false);
  const { qr } = mine;
  return (
    <>
      <section className={`${C.card} share-card`} aria-label={label}>
        {children}
        {qr ? (
          <img className="qr" src={qr.image} alt={t("qr.alt", { name: account.contact.name })} />
        ) : (
          <span className="qr qr-blank" aria-hidden="true" />
        )}
        <span className={C.muted}>{scanLine}</span>
        <div className="share-grid">
          <button type={C.button} className={C.accent} disabled={!qr} onClick={() => void mine.share(share)}>
            {t("qr.share")}
          </button>
          <button type={C.button} className={C.secondary} disabled={!qr} onClick={() => void mine.copy()}>
            {t("qr.copy")}
          </button>
          {qr ? (
            <a className={C.secondary} download={QR_FILE} href={qr.image}>
              {t("qr.download")}
            </a>
          ) : (
            <button type={C.button} className={C.secondary} disabled>
              {t("qr.download")}
            </button>
          )}
        </div>
        <div className="share-grid quiet">
          <button type={C.button} className={C.quiet} onClick={() => setScanning(true)}>
            {t("qr.scan")}
          </button>
          {qr && <NewQr busy={mine.busy} onRenew={mine.renew} />}
        </div>
        <span className={C.faint} role="status" aria-live="polite">
          {mine.status && t(mine.status)}
        </span>
      </section>
      {scanning && <QrScan onCode={onScanned} onClose={() => setScanning(false)} />}
    </>
  );
}
