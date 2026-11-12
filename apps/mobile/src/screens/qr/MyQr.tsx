import type { Ports } from "@gigsync/core";
import type { QrCode } from "@gigsync/protocol";
import { type ReactNode, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { QR_FILE } from "../../qr/myQr.js";
import { type ShareWords, useMyQr } from "../../qr/useMyQr.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
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
  /** Under "Scan a QR": whose QR the owner would scan (a worker scans a household's, and the other way round). */
  scanSub: string;
  /** More rows after "Scan a QR" in its list (a worker's "Change by talking"). */
  rows?: ReactNode;
  /** Under the rows: the worker's board switch. */
  below?: ReactNode;
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
 * My card under who the owner is (`children`): the QR on a white tile in its own card (drawn at once from the code kept
 * on this phone; a blank tile the first time) with what scanning it does; Share as the one primary action, Save QR
 * beside it and Copy link quieter; Scan a QR as a row with any `rows` after it; `below`; and at the foot, quiet, Make a
 * new QR. Anyone's phone camera opens the link; the app routes it after sign-in. Scanning here asks for the camera only
 * when tapped. One region holds it all, named `label`, for the worker's card and the household's alike.
 */
export function MyQr({ ports, account, label, children, scanLine, scanSub, rows, below, share, onScanned }: Props) {
  const { t } = useI18n();
  const mine = useMyQr(ports, account);
  const [scanning, setScanning] = useState(false);
  const { qr } = mine;
  return (
    <>
      <section className="my-qr" aria-label={label}>
        {children}
        <div className={`${C.card} qr-card`}>
          {qr ? (
            <img className="qr" src={qr.image} alt={t("qr.alt", { name: account.contact.name })} />
          ) : (
            <span className="qr qr-blank" aria-hidden="true" />
          )}
          <p className="qr-line">{scanLine}</p>
        </div>
        <div className="qr-share">
          <button type={C.button} className={C.accent} disabled={!qr} onClick={() => void mine.share(share)}>
            <Icon name="share" />
            {t("qr.share")}
          </button>
          {qr ? (
            <a className={C.secondary} download={QR_FILE} href={qr.image}>
              <Icon name="download" />
              {t("qr.download")}
            </a>
          ) : (
            <button type={C.button} className={C.secondary} disabled>
              <Icon name="download" />
              {t("qr.download")}
            </button>
          )}
        </div>
        <button type={C.button} className={C.quiet} disabled={!qr} onClick={() => void mine.copy()}>
          <Icon name="copy" />
          {t("qr.copy")}
        </button>
        <ListCard>
          <ListRow icon="qr" title={t("qr.scan")} sub={scanSub} onClick={() => setScanning(true)} />
          {rows}
        </ListCard>
        {below}
        <span className={C.faint} role="status" aria-live="polite">
          {mine.status && t(mine.status)}
        </span>
        {qr && <NewQr busy={mine.busy} onRenew={mine.renew} />}
      </section>
      {scanning && <QrScan onCode={onScanned} onClose={() => setScanning(false)} />}
    </>
  );
}
