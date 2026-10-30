import type { QrCode } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { forgetOpenedCode, onLinkOpened, openedCode } from "../adapters/links.js";

/**
 * QR links opened by the phone's camera (the page's `?to=`) or handed to the native app: kept until someone is signed
 * in (`ready`), then `open` gets the code once. `open` should keep its identity across renders.
 */
export function useOpenedQr(ready: boolean, open: (code: QrCode) => void): void {
  const [pending, setPending] = useState<QrCode | undefined>(openedCode);
  useEffect(() => onLinkOpened(setPending), []);
  useEffect(() => {
    if (!ready || !pending) return;
    forgetOpenedCode();
    setPending(undefined);
    open(pending);
  }, [ready, pending, open]);
}
