import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { codeIn, log, qrLink } from "@gigsync/core";
import { QR_PARAM, QrCode } from "@gigsync/protocol";

/**
 * Where a QR link points: the web app's public address, baked in as VITE_APP_URL, so a QR made in the phone app opens
 * the website for someone without it. Without it (dev, or the website itself), the page's own address.
 */
const APP_URL: string = import.meta.env.VITE_APP_URL?.replace(/\/+$/, "") || window.location.origin;

/** The link a person's QR carries. */
export const myQrLink = (code: QrCode): string => qrLink(APP_URL, code);

/** Keeps a code opened before sign-in for after it, across a reload of the sign-in screen. */
const PENDING_KEY = "gigsync-qr-pending";

function keep(code: QrCode): void {
  try {
    sessionStorage.setItem(PENDING_KEY, code);
  } catch (err) {
    log.warn("qr link not kept", { error: err instanceof Error ? err.name : String(err) });
  }
}

/** The code kept from a link opened before sign-in, if any. */
function kept(): QrCode | undefined {
  try {
    const code = QrCode.safeParse(sessionStorage.getItem(PENDING_KEY));
    return code.success ? code.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The code of a QR link the page was opened with (`?to=<code>`, as the phone's camera opens it), taken out of the
 * address so a reload does not open it again, and kept until `forgetOpenedCode`; or one kept from before a reload.
 */
export function openedCode(): QrCode | undefined {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(QR_PARAM)) return kept();
  const code = codeIn(url.href);
  if (code) keep(code);
  url.searchParams.delete(QR_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
  return code;
}

/** The opened link was shown: a reload no longer opens it. */
export function forgetOpenedCode(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing was kept where storage is refused.
  }
}

/**
 * On a native phone, a QR link that opened the app or arrived while it runs (Android's app links, iOS universal links,
 * once the domain is set up for them) is kept like one the page opened with, and handed to `opened`. Returns a
 * function that removes the listener.
 */
export function onLinkOpened(opened: (code: QrCode) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const take = (url: string | undefined) => {
    const code = url && codeIn(url);
    if (!code) return;
    keep(code);
    opened(code);
  };
  void App.getLaunchUrl().then((launch) => take(launch?.url));
  const listening = App.addListener("appUrlOpen", ({ url }) => take(url));
  return () => void listening.then((l) => l.remove());
}
