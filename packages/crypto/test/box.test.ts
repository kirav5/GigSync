import { describe, expect, it } from "vitest";
import {
  BOX_KEY_BYTES,
  BOX_OVERHEAD_BYTES,
  BoxError,
  fromBase64Url,
  lockBox,
  newBoxKey,
  openBox,
  toBase64Url,
} from "../src/index.js";

const text = (b: Uint8Array) => new TextDecoder().decode(b);
const bytes = (s: string) => new TextEncoder().encode(s);
const BODY = bytes(JSON.stringify({ jobs: [{ id: "eng_1", price: 70000 }] }));
const FOR_SITA = "gigsync/move/v1:usr_sita";

describe("box", () => {
  it("opens with the same key and context, and adds only its overhead", () => {
    const key = newBoxKey();
    const box = lockBox(key, BODY, FOR_SITA);
    expect(box.length).toBe(BODY.length + BOX_OVERHEAD_BYTES);
    expect(text(openBox(key, box, FOR_SITA))).toBe(text(BODY));
  });

  it("each key is fresh, and the same body never locks the same way twice", () => {
    const key = newBoxKey();
    expect(key.length).toBe(BOX_KEY_BYTES);
    expect(toBase64Url(newBoxKey())).not.toBe(toBase64Url(key));
    expect(toBase64Url(lockBox(key, BODY, FOR_SITA))).not.toBe(toBase64Url(lockBox(key, BODY, FOR_SITA)));
  });

  it("refuses another key, another owner's context, or an altered box", () => {
    const key = newBoxKey();
    const box = lockBox(key, BODY, FOR_SITA);
    expect(() => openBox(newBoxKey(), box, FOR_SITA)).toThrow(BoxError);
    expect(() => openBox(key, box, "gigsync/move/v1:usr_geeta")).toThrow(BoxError);
    const altered = box.slice();
    altered[altered.length - 1] = (altered[altered.length - 1] ?? 0) ^ 1;
    expect(() => openBox(key, altered, FOR_SITA)).toThrow(BoxError);
  });

  it("refuses a key of the wrong length", () => {
    expect(() => lockBox(new Uint8Array(16), BODY, FOR_SITA)).toThrow(BoxError);
  });
});

describe("base64url", () => {
  it("round-trips bytes without padding or URL-unsafe characters", () => {
    for (const length of [0, 1, 2, 3, 31, 32, 33]) {
      const raw = Uint8Array.from({ length }, (_, i) => (i * 97 + 251) % 256);
      const encoded = toBase64Url(raw);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect([...fromBase64Url(encoded)]).toEqual([...raw]);
    }
  });

  it("a 32-byte key is 43 characters", () => {
    expect(toBase64Url(newBoxKey())).toHaveLength(43);
  });
});
