import { log } from "@gigsync/core";

/** How a file left the app: through the phone's share sheet (save to Files, send in an app), or as a download. */
export const Saved = { shared: "shared", downloaded: "downloaded", cancelled: "cancelled" } as const;
export type Saved = (typeof Saved)[keyof typeof Saved];

/** The owner closed the share sheet without choosing: nothing went wrong. */
const ABORTED = "AbortError";

/**
 * Hands a small text file to the owner. On a phone whose web view shares files (iOS, Android's browsers), the share
 * sheet, which saves to Files or sends it in any app; anywhere else, an ordinary download.
 */
export async function saveTextFile(name: string, text: string, type: string): Promise<Saved> {
  const file = new File([text], name, { type });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return Saved.shared;
    } catch (err) {
      if (err instanceof Error && err.name === ABORTED) return Saved.cancelled;
      log.warn("sharing a file failed", { error: err instanceof Error ? err.name : String(err) });
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick: the click has handed the file to the browser by then.
  setTimeout(() => URL.revokeObjectURL(url));
  return Saved.downloaded;
}
