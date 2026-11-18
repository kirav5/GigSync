import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { log } from "@gigsync/core";

/** How a file left the app: through the phone's share sheet (save to Files, send in an app), or as a download. */
export const Saved = { shared: "shared", downloaded: "downloaded", cancelled: "cancelled" } as const;
export type Saved = (typeof Saved)[keyof typeof Saved];

/** The owner closed the share sheet without choosing: nothing went wrong. */
const ABORTED = "AbortError";
/** What the Share plugin rejects with when the owner closes its sheet (its message; it has no code for it). */
const NATIVE_CANCELLED = /cancel/i;
/** A data URL's header, before the file's base64. */
const DATA_URL_HEAD = /^data:[^,]*,/;

/** The file's bytes as base64, as the Filesystem plugin writes them. */
function base64Of(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(DATA_URL_HEAD, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * In the phone app, whose web view neither downloads nor shares files: the file written to the app's cache, then the
 * phone's own share sheet with it, which saves to Files, Drive or Photos or sends it in any app.
 */
async function shareNative(name: string, file: Blob): Promise<Saved> {
  const { uri } = await Filesystem.writeFile({ path: name, data: await base64Of(file), directory: Directory.Cache });
  try {
    await Share.share({ title: name, files: [uri] });
    return Saved.shared;
  } catch (err) {
    if (err instanceof Error && NATIVE_CANCELLED.test(err.message)) return Saved.cancelled;
    throw err;
  }
}

/** A browser: the share sheet where it shares files (phones' browsers), else an ordinary download. */
async function saveInBrowser(name: string, file: File): Promise<Saved> {
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

/** Hands a file to the owner: the share sheet in the phone app, else the browser's share sheet or a download. */
export function saveFile(name: string, file: Blob): Promise<Saved> {
  if (Capacitor.isNativePlatform()) return shareNative(name, file);
  return saveInBrowser(name, new File([file], name, { type: file.type }));
}

/** A small text file (the record), handed over as `saveFile` does. */
export const saveTextFile = (name: string, text: string, type: string): Promise<Saved> =>
  saveFile(name, new Blob([text], { type }));
