import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { FIELD_END } from "../src/identity/card-fields.js";
import { MAX_QR_DIGITS } from "../src/identity/qr-bytes.js";
import { SECURE_QR_SIGNATURE, UIDAI_SECURE_QR_KEYS, uidaiKeys } from "../src/identity/uidai-key.js";
import { CardGender, checkAadhaarQr, IdCheckProblem, idCheckAvailable, MobileBinding } from "../src/index.js";
import { uidaiChain } from "./ekyc-fixtures.js";

const NOW = new Date("2026-11-15T10:00:00.000Z");
/** UIDAI signs with RSA-2048. */
const UIDAI_KEY_BITS = 2048;
const ADDRESS = [
  "S/O Ramesh Kumar",
  "Bengaluru Urban",
  "Near Temple",
  "12",
  "Jayanagar",
  "560041",
  "Jayanagar",
  "Karnataka",
  "4th Main",
  "Bengaluru South",
  "Bengaluru",
];
const REFERENCE_ID = "3456" + "20190315123456789";
const PERSON = ["Lakshmi Devi", "15-08-1990", "F"];
const PHOTO = Uint8Array.from([0xff, 0x4f, 0xff, 0x51, ...new TextEncoder().encode("PHOTO-JP2"), 0xff, 0xff]);
const HASH = new Uint8Array(32).fill(0xab);

const text = (fields: string[]) => {
  const parts = fields.flatMap((f) => [...new TextEncoder().encode(f), FIELD_END]);
  return Uint8Array.from(parts);
};
const join = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));

/** The text of a QR: gzip, then the bytes read as one big-endian decimal number. */
const qrText = (unzipped: Uint8Array) => BigInt(`0x${Buffer.from(gzipSync(unzipped)).toString("hex")}`).toString();

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
const sign = async (payload: Uint8Array, key = keys.privateKey) =>
  join(payload, new Uint8Array(await crypto.subtle.sign(SECURE_QR_SIGNATURE, key, payload)));

const v2Payload = () => join(text(["V2", "3", REFERENCE_ID, ...PERSON, ...ADDRESS, "9876"]), PHOTO);
const legacyPayload = () => join(text(["3", REFERENCE_ID, ...PERSON, ...ADDRESS]), PHOTO, HASH, HASH);

beforeAll(async () => {
  const params = { ...SECURE_QR_SIGNATURE, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
  keys = await crypto.subtle.generateKey(params, false, ["sign", "verify"]);
  otherKeys = await crypto.subtle.generateKey(params, false, ["sign", "verify"]);
});

const check = (qr: string, key = keys.publicKey) => checkAadhaarQr(qr, { key, now: NOW });

describe("Aadhaar Secure QR check", () => {
  const kept = { name: "Lakshmi Devi", birthYear: 1990, gender: CardGender.female, aadhaarLast4: "3456" };

  it("keeps only the name, year, gender, last 4 digits and time from a V2 card", async () => {
    const result = await check(qrText(await sign(v2Payload())));
    expect(result).toMatchObject({ ok: true, id: { ...kept, checkedAt: NOW.toISOString() } });
  });

  it("reads the older layout, whose first field is the email/mobile indicator", async () => {
    const result = await check(qrText(await sign(legacyPayload())));
    expect(result).toMatchObject({ ok: true, id: { ...kept, checkedAt: NOW.toISOString() } });
  });

  it("carries no address, full reference, mobile digits or photo", async () => {
    const result = await check(qrText(await sign(v2Payload())));
    const json = JSON.stringify(result);
    for (const leak of [...ADDRESS, REFERENCE_ID, "15-08-1990", "9876", "PHOTO"]) expect(json).not.toContain(leak);
    expect(result.ok && Object.keys(result.id).sort()).toEqual([
      "aadhaarLast4",
      "birthYear",
      "checkedAt",
      "gender",
      "name",
    ]);
  });

  it("refuses a card with one byte changed after signing", async () => {
    const signed = await sign(v2Payload());
    const nameAt = signed.indexOf("L".charCodeAt(0));
    signed[nameAt] = "M".charCodeAt(0);
    expect(await check(qrText(signed))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });

  it("refuses a card signed by anyone else", async () => {
    const forged = await sign(v2Payload(), otherKeys.privateKey);
    expect(await check(qrText(forged))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });

  it("refuses text that is not one decimal number, or too long to be a QR", async () => {
    expect(await check("upi://pay?pa=someone@upi")).toEqual({ ok: false, problem: IdCheckProblem.not_a_number });
    expect(await check("")).toEqual({ ok: false, problem: IdCheckProblem.not_a_number });
    expect(await check("9".repeat(MAX_QR_DIGITS + 1))).toEqual({ ok: false, problem: IdCheckProblem.not_a_number });
  });

  it("refuses a number that is not gzip", async () => {
    expect(await check("123456789012345678901234567890")).toEqual({ ok: false, problem: IdCheckProblem.not_gzip });
  });

  it("refuses data too short to hold a signature", async () => {
    expect(await check(qrText(text(["V2", "3", REFERENCE_ID])))).toEqual({
      ok: false,
      problem: IdCheckProblem.too_short,
    });
  });

  it("refuses signed data that is not laid out as an Aadhaar card", async () => {
    const notACard = await sign(text(["hello", "world"]));
    expect(await check(qrText(notACard))).toEqual({ ok: false, problem: IdCheckProblem.not_aadhaar });
    const noGender = await sign(
      join(text(["V2", "3", REFERENCE_ID, "Lakshmi Devi", "15-08-1990", "X", ...ADDRESS, "9876"]), PHOTO),
    );
    expect(await check(qrText(noGender))).toEqual({ ok: false, problem: IdCheckProblem.not_aadhaar });
  });

  it.skipIf(idCheckAvailable())("refuses to run without UIDAI's key", async () => {
    const result = await checkAadhaarQr(qrText(await sign(v2Payload())), { now: NOW });
    expect(result).toEqual({ ok: false, problem: IdCheckProblem.no_uidai_key });
  });

  it("loads every UIDAI key as a 2048-bit RSA key that only verifies", async () => {
    const keys = await uidaiKeys();
    expect(keys).toHaveLength(UIDAI_SECURE_QR_KEYS.length);
    for (const key of keys) {
      expect(key.usages).toEqual(["verify"]);
      expect((key.algorithm as RsaHashedKeyAlgorithm).modulusLength).toBe(UIDAI_KEY_BITS);
    }
  });

  it("does not take a card signed by someone else as UIDAI's", async () => {
    // Signed with this test's own key, so none of UIDAI's matches.
    const result = await checkAadhaarQr(qrText(await sign(v2Payload())), { now: NOW });
    expect(result).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });
});

describe("Aadhaar Secure QR mobile binding", () => {
  /** The reference id starts 3456, so the Aadhaar ends in 6: UIDAI hashes the mobile 6 times. */
  const PHONE = "+919876543210";
  const OTHER = "+919811000000";
  const bind = async (payload: Uint8Array, phone = PHONE) => {
    const result = await checkAadhaarQr(qrText(await sign(payload)), { key: keys.publicKey, now: NOW, phone });
    if (!result.ok) throw new Error(`refused: ${result.problem}`);
    return result;
  };
  const legacy = (indicator: string, mobileHash: Uint8Array) =>
    join(text([indicator, REFERENCE_ID, ...PERSON, ...ADDRESS]), PHOTO, HASH, mobileHash);
  const mobileHash = Buffer.from(uidaiChain("9876543210", 6), "hex");

  it("binds a V2 card by the last 4 digits it prints", async () => {
    expect((await bind(v2Payload(), "+919811009876")).binding).toBe(MobileBinding.matched_last4);
    const other = await bind(v2Payload(), OTHER);
    expect(other.binding).toBe(MobileBinding.not_matched);
    expect(await other.mobile.matches("+919000009876")).toBe(MobileBinding.matched_last4);
  });

  it("says a V2 card with no mobile digits has none linked", async () => {
    const none = join(text(["V2", "1", REFERENCE_ID, ...PERSON, ...ADDRESS, ""]), PHOTO);
    expect((await bind(none)).binding).toBe(MobileBinding.not_linked);
  });

  it("binds an older card by the hash of the whole number, the last thing before the signature", async () => {
    expect((await bind(legacy("3", mobileHash))).binding).toBe(MobileBinding.matched);
    expect((await bind(legacy("2", mobileHash))).binding).toBe(MobileBinding.matched);
    const other = await bind(legacy("3", mobileHash), OTHER);
    expect(other.binding).toBe(MobileBinding.not_matched);
    expect(await other.mobile.matches(PHONE)).toBe(MobileBinding.matched);
  });

  it("says an older card whose indicator has no mobile has none linked", async () => {
    for (const indicator of ["0", "1"])
      expect((await bind(legacy(indicator, mobileHash))).binding).toBe(MobileBinding.not_linked);
  });

  it("never serializes the mobile hash or digits", async () => {
    expect(JSON.stringify(await bind(legacy("3", mobileHash)))).not.toContain(mobileHash.toString("hex"));
    expect(JSON.stringify(await bind(v2Payload()))).not.toContain("9876");
  });
});
