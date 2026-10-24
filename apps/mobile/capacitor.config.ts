import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.gigsync",
  appName: "GigSync",
  webDir: "dist",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
  server: { androidScheme: "https" },
};

export default config;
