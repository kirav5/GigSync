import { defineConfig } from "vitest/config";

// Phones read times on their own clock (ADR 0053 §2: a time that has passed): the tests run on the pilot's, Indian
// time, so a job's morning is over at the same instant on every machine, CI's UTC included.
process.env.TZ = "Asia/Kolkata";

export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
