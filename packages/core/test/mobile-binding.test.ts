import { describe, expect, it } from "vitest";
import {
  aadhaarMobile,
  chainedSha256,
  hashFromHex,
  hashRounds,
  MobileBinding,
  MobileEvidence,
} from "../src/identity/mobile-binding.js";
import { uidaiChain } from "./ekyc-fixtures.js";

/**
 * UIDAI's mobile hash rules. UIDAI publishes the rule and a worked input but no output, so the expected hashes here
 * were computed independently with Python's hashlib (`hashlib.sha256(s.encode()).hexdigest()` chained) and Node's
 * crypto (ekyc-fixtures.ts uidaiChain), and must agree with core's WebCrypto chain.
 */

/**
 * UIDAI's own example (https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc): mobile 1234567890, share phrase
 * Lock@487, Aadhaar ending 3632, so "Sha256(Sha256(1234567890Lock@487))*2": two rounds.
 */
const UIDAI_EXAMPLE = {
  input: "1234567890Lock@487",
  last4: "3632",
  hash: "f7250dc9e61759253bb741efbae306311632049154da7286e20b047bf3421a8f",
};
/** One round of 9876543210: what digits 0 and 1 both give. */
const ONE_ROUND = "7619ee8cea49187f309616e30ecf54be072259b43760f1f550a644945d5572f2";
const MOBILE = "9876543210";
const PHONE = `+91${MOBILE}`;

describe("UIDAI's mobile hash", () => {
  it("matches UIDAI's worked example, two rounds over the hex of the one before", async () => {
    expect(hashRounds(UIDAI_EXAMPLE.last4)).toBe(2);
    expect(await chainedSha256(UIDAI_EXAMPLE.input, 2)).toBe(UIDAI_EXAMPLE.hash);
    expect(uidaiChain(UIDAI_EXAMPLE.input, 2)).toBe(UIDAI_EXAMPLE.hash);
  });

  it("hashes once when the Aadhaar number ends in 0 or 1, and as many times as the digit otherwise", async () => {
    expect([hashRounds("1230"), hashRounds("1231"), hashRounds("1239")]).toEqual([1, 1, 9]);
    expect(await chainedSha256(MOBILE, hashRounds("4560"))).toBe(ONE_ROUND);
    expect(await chainedSha256(MOBILE, hashRounds("4561"))).toBe(ONE_ROUND);
    for (const rounds of [2, 5, 9]) expect(await chainedSha256(MOBILE, rounds)).toBe(uidaiChain(MOBILE, rounds));
  });

  it("hashes the 10-digit Indian number, never +91 or another country's", () => {
    expect(aadhaarMobile(PHONE)).toBe(MOBILE);
    expect(aadhaarMobile("+14155550123")).toBeUndefined();
    expect(aadhaarMobile("+9198765")).toBeUndefined();
  });

  it("reads UIDAI's hex in either case, and nothing that is not a 32-byte hash", () => {
    expect(hashFromHex(ONE_ROUND.toUpperCase())).toEqual(hashFromHex(ONE_ROUND));
    expect(hashFromHex("")).toBeUndefined();
    expect(hashFromHex("ab")).toBeUndefined();
  });
});

describe("mobile evidence", () => {
  const hashed = (text: string, rounds: number) => hashFromHex(uidaiChain(text, rounds));

  it("matches a whole number against a hash with the share code after it", async () => {
    const evidence = MobileEvidence.hashed(hashed(`${MOBILE}Ab3x`, 6), "Ab3x", "3456");
    expect(await evidence.matches(PHONE)).toBe(MobileBinding.matched);
    expect(await evidence.matches("+919876543211")).toBe(MobileBinding.not_matched);
    expect(await evidence.matches("+14155550123")).toBe(MobileBinding.not_matched);
    expect(await evidence.matches(undefined)).toBe(MobileBinding.not_matched);
  });

  it("matches only the last 4 digits when that is all the card prints", async () => {
    const evidence = MobileEvidence.lastFour("3210");
    expect(await evidence.matches(PHONE)).toBe(MobileBinding.matched_last4);
    expect(await evidence.matches("+919876540000")).toBe(MobileBinding.not_matched);
  });

  it("says nothing is linked when the Aadhaar has no mobile", async () => {
    expect(await MobileEvidence.lastFour("").matches(PHONE)).toBe(MobileBinding.not_linked);
    expect(await MobileEvidence.hashed(undefined, "", "3456").matches(PHONE)).toBe(MobileBinding.not_linked);
  });

  it("never serializes the hash, the share code or the digits", () => {
    const evidence = MobileEvidence.hashed(hashed(`${MOBILE}Ab3x`, 6), "Ab3x", "3456");
    expect(JSON.stringify({ evidence, last4: MobileEvidence.lastFour("3210") })).toBe('{"evidence":{},"last4":{}}');
  });
});
