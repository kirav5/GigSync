import { Capacitor } from "@capacitor/core";

/**
 * Keeps the field being typed into above the on-screen keyboard. The keyboard shrinks the web view (the Keyboard
 * plugin's resize "native", in capacitor.config.ts), but the app scrolls inside its content panel, not the page, and
 * Android's WebView only brings a focused field into view for the page. So when the web view changes size with a
 * field focused, the app scrolls it into view. This runs on the resize itself, not the plugin's keyboardDidShow,
 * which on iOS fires before the web view has shrunk.
 */
export function keepFocusedFieldVisible(): void {
  if (!Capacitor.isNativePlatform()) return;
  globalThis.addEventListener("resize", () => {
    const field = document.activeElement;
    const typing =
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement;
    if (typing) field.scrollIntoView({ block: "nearest" });
  });
}
