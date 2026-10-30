import { log, type MessageKey, type Ports } from "@gigsync/core";
import { useEffect, useState } from "react";
import type { Account } from "../adapters/account.js";
import { copyText } from "../adapters/clipboard.js";
import { ShareResult, shareLink } from "../adapters/share.js";
import { loadMyQr, replaceMyQr, type ShownQr } from "./myQr.js";
import { qrErrorKey } from "./problems.js";

/** What the share sheet says with the link: who it finds, in the owner's words. */
export interface ShareWords {
  title: string;
  text: string;
}

/**
 * The owner's QR for My card, and what its buttons do: drawn at once from the code kept on this phone, shared through
 * the phone's share sheet (copied where there is none), copied, or replaced by a new one. `status` is the line that
 * says how the last of them went.
 */
export function useMyQr(ports: Ports, account: Account) {
  const [qr, setQr] = useState<ShownQr>();
  const [status, setStatus] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);

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

  const share = async (words: ShareWords) => {
    if (!qr) return;
    const result = await shareLink({ ...words, url: qr.link });
    if (result === ShareResult.unsupported) return copy();
    setStatus(result === ShareResult.shared ? "qr.shared" : undefined);
  };

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

  return { qr, status, busy, copy, share, renew };
}
