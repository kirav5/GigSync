import type { CapacitorConfig } from "@capacitor/cli";

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
  ios: { contentInset: "automatic" },
  server: { androidScheme: "https", ...(devServer ? { url: devServer, cleartext: true } : {}) },
};

export default config;
