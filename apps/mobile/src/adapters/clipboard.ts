import { log } from "@gigsync/core";

/** Puts words on the phone's clipboard; false when the web view does not allow it (no secure context, or refused). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    log.warn("copy to clipboard failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
