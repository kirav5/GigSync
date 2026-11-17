import { log, type MessageKey, type Ports } from "@gigsync/core";
import { useEffect, useState } from "react";
import type { Account } from "../adapters/account.js";
import { copyText } from "../adapters/clipboard.js";
import { ShareResult, shareLink } from "../adapters/share.js";
import { loadMyQr, type ShownQr } from "./myQr.js";
import { qrErrorKey } from "./problems.js";

/** What the share sheet says with the link: who it finds, in the owner's words. */
export interface ShareWords {
  title: string;
  text: string;
}

/**
 * The owner's QR for My card, and what its buttons do: drawn at once from the code kept on this phone, shared through
 * the phone's share sheet (copied where there is none), or copied. `status` is the line that says how the last of them
 * went. Asking the server for it also tells it the owner's first name and role as they are now, so a scanner sees them.
 */
export function useMyQr(ports: Ports, account: Account) {
  const [qr, setQr] = useState<ShownQr>();
  const [status, setStatus] = useState<MessageKey>();

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

  return { qr, status, copy, share };
}
