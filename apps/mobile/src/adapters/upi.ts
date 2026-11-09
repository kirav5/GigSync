import { Capacitor, registerPlugin } from "@capacitor/core";
import { log } from "@gigsync/core";

/** The app's own Android plugin (`UpiPlugin.java`): the system chooser, listing every UPI app on the phone. */
interface UpiPlugin {
  pay(options: { link: string; title: string }): Promise<void>;
}
const GigSyncUpi = registerPlugin<UpiPlugin>("GigSyncUpi");

const ANDROID = "android";
const ANDROID_BROWSER = /Android/;

/**
 * How this phone opens a UPI link so the household picks the app: the system chooser in the Android app; one button
 * per app in a browser on Android, where a page cannot list the apps and a bare link goes to the default one; the
 * plain link elsewhere (iPhone opens the app that claims it; a computer scans the QR).
 */
export const UpiOpen = { chooser: "chooser", apps: "apps", link: "link" } as const;
export type UpiOpen = (typeof UpiOpen)[keyof typeof UpiOpen];

export function upiOpen(): UpiOpen {
  if (Capacitor.getPlatform() === ANDROID) return UpiOpen.chooser;
  if (!Capacitor.isNativePlatform() && ANDROID_BROWSER.test(navigator.userAgent)) return UpiOpen.apps;
  return UpiOpen.link;
}

/** Shows Android's chooser for the link; false when the plugin is missing or no app takes it. */
export async function payInChooser(link: string, title: string): Promise<boolean> {
  try {
    await GigSyncUpi.pay({ link, title });
    return true;
  } catch (err) {
    log.warn("upi chooser failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
