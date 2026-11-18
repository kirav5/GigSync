import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { log } from "@gigsync/core";

/** What a share ended in: sent to an app, closed by the owner, or no share sheet here (the caller copies instead). */
export const ShareResult = { shared: "shared", cancelled: "cancelled", unsupported: "unsupported" } as const;
export type ShareResult = (typeof ShareResult)[keyof typeof ShareResult];

/** The owner closed the share sheet without choosing an app: nothing went wrong. */
const ABORTED = "AbortError";

/** What the Share plugin rejects with when the owner closes its sheet (its message; it has no code for it). */
const NATIVE_CANCELLED = /cancel/i;

/** In the phone app: Android's web view has no Web Share API, so the plugin opens the phone's own sheet. */
async function shareNative(link: { title: string; text: string; url: string }): Promise<ShareResult> {
  try {
    await Share.share({ ...link, dialogTitle: link.title });
    return ShareResult.shared;
  } catch (err) {
    if (err instanceof Error && NATIVE_CANCELLED.test(err.message)) return ShareResult.cancelled;
    log.warn("share failed", { error: err instanceof Error ? err.name : String(err) });
    return ShareResult.unsupported;
  }
}

/** The phone's own share sheet with a link: the plugin's in the phone app, the Web Share API in a browser. */
export async function shareLink(link: { title: string; text: string; url: string }): Promise<ShareResult> {
  if (Capacitor.isNativePlatform()) return shareNative(link);
  if (typeof navigator.share !== "function" || (navigator.canShare && !navigator.canShare(link)))
    return ShareResult.unsupported;
  try {
    await navigator.share(link);
    return ShareResult.shared;
  } catch (err) {
    if (err instanceof Error && err.name === ABORTED) return ShareResult.cancelled;
    log.warn("share failed", { error: err instanceof Error ? err.name : String(err) });
    return ShareResult.unsupported;
  }
}

/** WhatsApp's own address for a message with no number: it opens WhatsApp, and the owner picks who gets it. */
const WHATSAPP_SEND = "https://wa.me/";
const WHATSAPP_TEXT = "text";

/** Opens WhatsApp with these words ready to send. A share sheet is missing in some web views; this works everywhere. */
export function whatsAppLink(words: string): string {
  const url = new URL(WHATSAPP_SEND);
  url.searchParams.set(WHATSAPP_TEXT, words);
  return url.toString();
}
