import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Capacitor loads the build from the app bundle, so asset paths must be relative.
  base: "./",
  build: { outDir: "dist", target: "es2022", sourcemap: true },
  server: { port: 5173, host: true },
});
