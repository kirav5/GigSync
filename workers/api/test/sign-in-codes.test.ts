import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CODE_TTL_MS, newCode, RESEND_MS, saveCode, takeCode } from "../src/auth/codes.js";
import { withDirectory } from "../src/db/client.js";

/** Architecture review row 1: a code per number, hashed, five minutes, once; a new one at most once a minute. */
const KEY = "test-only-key";
const NOW = new Date("2026-11-07T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const directory = <T>(fn: Parameters<typeof withDirectory<T>>[2]) =>
  withDirectory(env.DIRECTORY.connectionString, undefined, fn);

describe("sign-in codes", () => {
  it("are six digits, leading zeros kept, and vary", () => {
    const codes = Array.from({ length: 50 }, newCode);
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(new Set(codes).size).toBeGreaterThan(45);
  });

  it("work once, for their own number, and are never stored as they are", async () => {
    await directory(async (db) => {
      expect(await saveCode(db, KEY, "hmac-a", "123456", NOW)).toBe(true);
      const { rows } = await db.query<{ code_hash: string }>("SELECT code_hash FROM otp_codes WHERE phone_hmac = $1", [
        "hmac-a",
      ]);
      expect(rows[0]?.code_hash).not.toContain("123456");
      expect(await takeCode(db, KEY, "hmac-b", "123456", NOW)).toBe(false);
      expect(await takeCode(db, KEY, "hmac-a", "654321", NOW)).toBe(false);
      expect(await takeCode(db, KEY, "hmac-a", "123456", NOW)).toBe(true);
      expect(await takeCode(db, KEY, "hmac-a", "123456", NOW)).toBe(false);
    });
  });

  it("stop working after five minutes", async () => {
    await directory(async (db) => {
      await saveCode(db, KEY, "hmac-c", "111111", NOW);
      expect(await takeCode(db, KEY, "hmac-c", "111111", later(CODE_TTL_MS + 1))).toBe(false);
    });
  });

  it("are not sent again within a minute, and a new one replaces the old", async () => {
    await directory(async (db) => {
      expect(await saveCode(db, KEY, "hmac-d", "222222", NOW)).toBe(true);
      expect(await saveCode(db, KEY, "hmac-d", "333333", later(RESEND_MS / 2))).toBe(false);
      expect(await saveCode(db, KEY, "hmac-d", "444444", later(RESEND_MS))).toBe(true);
      expect(await takeCode(db, KEY, "hmac-d", "222222", later(RESEND_MS))).toBe(false);
      expect(await takeCode(db, KEY, "hmac-d", "444444", later(RESEND_MS))).toBe(true);
    });
  });
});
