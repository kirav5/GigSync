import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Development only: `CAP_SERVER_URL=http://localhost:5173 pnpm exec cap sync` makes a simulator load the app from
 * the Vite dev server (live reload, and the local API at localhost:8787). On the Android emulator, forward both
 * ports first with `adb reverse tcp:5173 tcp:5173` and `adb reverse tcp:8787 tcp:8787`. Release builds leave it unset.
 */
const devServer = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "app.gigsync",
  appName: "GigSync",
  webDir: "dist",
  android: { allowMixedContent: false },
  // Edge to edge on both phones; the CSS takes the safe areas off once (env(safe-area-inset-*)), so iOS must not too.
  ios: { contentInset: "never" },
  server: { androidScheme: "https", ...(devServer ? { url: devServer, cleartext: true } : {}) },
  plugins: {
    // Android edge to edge: "native" pads the web view or passes real values to env(safe-area-inset-*), which is all
    // the CSS reads. The default ("css") also injects --safe-area-inset-* variables nothing uses, and its first
    // injection runs before the page has a document, so every launch logged an error. index.html sets
    // viewport-fit=cover; telling SystemBars up front saves a layout jump while it reads the page.
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover" },
    // The keyboard shrinks the web view instead of scrolling the page under it, so the top bar stays put and the
    // focused field stays above the keys (iOS). On Android, SystemBars above already pads the web view by the
    // keyboard's height; Keyboard's resizeOnFullScreen workaround would resize it a second time, which SystemBars
    // warns against, and the sign-in screen with the keyboard up is pixel-identical without it.
    Keyboard: { resize: KeyboardResize.Native },
  },
};

export default config;
