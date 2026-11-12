import { defineConfig } from "vitest/config";

// The phone's storage (src/adapters/store) is the one part of the app tested here, in Node: WebCrypto is Node's own
// and IndexedDB is fake-indexeddb, so the key ranges, the sealing and the move run as they do in a browser.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
