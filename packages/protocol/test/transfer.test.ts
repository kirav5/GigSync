import { describe, expect, it } from "vitest";
import {
  TRANSFER_KEY_BYTES,
  TRANSFER_MAX_CHARS,
  TransferDownload,
  TransferKey,
  TransferQr,
  TransferSlot,
  TransferUpload,
} from "../src/index.js";

const SLOT = "xfr_01J0000000000000000000AAAA";
const DEVICE = "dev_01J0000000000000000000AAAA";
/** 32 bytes as base64url without padding. */
const KEY = "A".repeat(Math.ceil((TRANSFER_KEY_BYTES * 4) / 3));

describe("moving to a new phone", () => {
  it("takes base64 ciphertext up to the cap, and nothing else", () => {
    expect(TransferUpload.safeParse({ ciphertext: "aGVsbG8=" }).success).toBe(true);
    expect(TransferUpload.safeParse({ ciphertext: "A".repeat(TRANSFER_MAX_CHARS) }).success).toBe(true);
    expect(TransferUpload.safeParse({ ciphertext: "A".repeat(TRANSFER_MAX_CHARS + 4) }).success).toBe(false);
    expect(TransferUpload.safeParse({ ciphertext: "" }).success).toBe(false);
    expect(TransferUpload.safeParse({ ciphertext: "not base64!" }).success).toBe(false);
  });

  it("names a slot by an xfr id and a device by a dev id", () => {
    expect(TransferSlot.safeParse({ id: SLOT, expires_at: "2026-10-31T10:15:00.000Z" }).success).toBe(true);
    expect(TransferSlot.safeParse({ id: DEVICE, expires_at: "2026-10-31T10:15:00.000Z" }).success).toBe(false);
    expect(TransferDownload.safeParse({ ciphertext: "aGVsbG8=", device: DEVICE }).success).toBe(true);
    expect(TransferDownload.safeParse({ ciphertext: "aGVsbG8=", device: SLOT }).success).toBe(false);
  });

  it("carries the slot and a 32-byte base64url key in the QR", () => {
    expect(TransferQr.safeParse({ slot: SLOT, key: KEY }).success).toBe(true);
    expect(TransferKey.safeParse(`${KEY}A`).success).toBe(false);
    expect(TransferKey.safeParse(`${KEY.slice(1)}+`).success).toBe(false);
    expect(TransferQr.safeParse({ slot: "xfr_1", key: KEY }).success).toBe(false);
  });
});
