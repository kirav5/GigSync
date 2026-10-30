import { log } from "@gigsync/core";

/** What a share ended in: sent to an app, closed by the owner, or no share sheet here (the caller copies instead). */
export const ShareResult = { shared: "shared", cancelled: "cancelled", unsupported: "unsupported" } as const;
export type ShareResult = (typeof ShareResult)[keyof typeof ShareResult];

/** The owner closed the share sheet without choosing an app: nothing went wrong. */
const ABORTED = "AbortError";

/** The phone's own share sheet (the Web Share API, which Android's and iOS's web views also have), with a link. */
export async function shareLink(link: { title: string; text: string; url: string }): Promise<ShareResult> {
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
