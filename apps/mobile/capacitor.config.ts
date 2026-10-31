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
    // The keyboard shrinks the web view instead of scrolling the page under it, so the top bar stays put and the
    // focused field stays above the keys. resizeOnFullScreen: Android's edge-to-edge apps need it to resize at all.
    Keyboard: { resize: KeyboardResize.Native, resizeOnFullScreen: true },
  },
};

export default config;
