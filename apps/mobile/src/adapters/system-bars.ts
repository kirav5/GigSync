import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { log } from "@gigsync/core";

/**
 * The native apps' status and navigation bar icons, in step with the app's look rather than the phone's night mode:
 * dark icons on the cream look, light icons on the dark one. The app draws edge to edge, so the bars' background is
 * the page itself. In a browser the bar's colour comes from theme-color instead (ui/look.ts), and this does nothing.
 */
export function styleSystemBars(dark: boolean): void {
  if (!Capacitor.isNativePlatform()) return;
  // SystemBarsStyle names the background: Dark means light icons.
  SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch((err: unknown) =>
    log.warn("system bars not styled", { error: err instanceof Error ? err.message : String(err) }),
  );
}
