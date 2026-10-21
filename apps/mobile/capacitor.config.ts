import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "network.collabai.app",
  appName: "Collab",
  webDir: "dist",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
  server: { androidScheme: "https" },
};

export default config;
