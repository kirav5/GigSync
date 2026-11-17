import { beforeAll, describe, expect, it } from "vitest";
import { GOOGLE_KEYS_URL, GoogleKeys, TokenError, TokenProblem, verifyIdToken } from "../src/auth/firebase.js";
import { claimsFor, KID, PROJECT, type TestSigner, testSigner } from "./firebase-helpers.js";

const PHONE = "+919811000101";
const NOW = new Date("2026-11-15T10:00:00Z");
const HOUR_MS = 3_600_000;

let signer: TestSigner;
let fetched: string[];
let keys: GoogleKeys;

beforeAll(async () => {
  signer = await testSigner();
});

function freshKeys() {
  fetched = [];
  keys = new GoogleKeys(async (url) => {
    fetched.push(url);
    return signer.keysResponse();
  });
}

async function problemOf(token: string, now = NOW): Promise<unknown> {
  const err = await verifyIdToken(token, PROJECT, now, keys.keyFor).catch((e: unknown) => e);
  return err instanceof TokenError ? err.problem : err;
}

describe("firebase id token", () => {
  it("gives the number of a good token", async () => {
    freshKeys();
    const token = await signer.sign(claimsFor(PHONE, NOW));
    await expect(verifyIdToken(token, PROJECT, NOW, keys.keyFor)).resolves.toBe(PHONE);
    expect(fetched).toEqual([GOOGLE_KEYS_URL]);
  });

  it("refuses a token for another project", async () => {
    freshKeys();
    expect(await problemOf(await signer.sign(claimsFor(PHONE, NOW, { aud: "someone-else" })))).toBe(
      TokenProblem.wrongAudience,
    );
  });

  it("refuses a token from another issuer", async () => {
    freshKeys();
    const iss = "https://securetoken.google.com/someone-else";
    expect(await problemOf(await signer.sign(claimsFor(PHONE, NOW, { iss })))).toBe(TokenProblem.wrongIssuer);
  });

  it("refuses an expired token", async () => {
    freshKeys();
    const token = await signer.sign(claimsFor(PHONE, NOW));
    expect(await problemOf(token, new Date(NOW.getTime() + 2 * HOUR_MS))).toBe(TokenProblem.expired);
  });

  it("refuses a token issued in the future", async () => {
    freshKeys();
    const later = new Date(NOW.getTime() + HOUR_MS);
    expect(await problemOf(await signer.sign(claimsFor(PHONE, later)))).toBe(TokenProblem.fromTheFuture);
  });

  it("refuses a token whose signature does not match", async () => {
    freshKeys();
    const [head, , sig] = (await signer.sign(claimsFor(PHONE, NOW))).split(".");
    const [, body] = (await signer.sign(claimsFor("+919811000999", NOW))).split(".");
    expect(await problemOf(`${head}.${body}.${sig}`)).toBe(TokenProblem.badSignature);
  });

  it("refuses a token signed by another key", async () => {
    freshKeys();
    const other = await testSigner();
    expect(await problemOf(await other.sign(claimsFor(PHONE, NOW)))).toBe(TokenProblem.badSignature);
  });

  it("refuses a token without a phone number, or with one that is not E.164", async () => {
    freshKeys();
    expect(await problemOf(await signer.sign(claimsFor(PHONE, NOW, { phone_number: undefined })))).toBe(
      TokenProblem.noPhone,
    );
    expect(await problemOf(await signer.sign(claimsFor(PHONE, NOW, { phone_number: "98110 00101" })))).toBe(
      TokenProblem.noPhone,
    );
  });

  it("refuses a token without a user", async () => {
    freshKeys();
    expect(await problemOf(await signer.sign(claimsFor(PHONE, NOW, { sub: "" })))).toBe(TokenProblem.malformed);
  });

  it("refuses another algorithm, an unknown key and garbage", async () => {
    freshKeys();
    const claims = claimsFor(PHONE, NOW);
    expect(await problemOf(await signer.sign(claims, { alg: "none", kid: KID }))).toBe(TokenProblem.wrongAlgorithm);
    expect(await problemOf(await signer.sign(claims, { alg: "RS256", kid: "rotated-out" }))).toBe(
      TokenProblem.unknownKey,
    );
    expect(await problemOf("not.a-token")).toBe(TokenProblem.malformed);
    expect(await problemOf("a.b.c")).toBe(TokenProblem.malformed);
  });

  it("keeps the keys for Google's max-age, then fetches them again", async () => {
    freshKeys();
    const token = await signer.sign(claimsFor(PHONE, NOW));
    await verifyIdToken(token, PROJECT, NOW, keys.keyFor);
    await verifyIdToken(token, PROJECT, new Date(NOW.getTime() + HOUR_MS / 2), keys.keyFor);
    expect(fetched).toHaveLength(1);
    await keys.keyFor(KID, new Date(NOW.getTime() + HOUR_MS));
    expect(fetched).toHaveLength(2);
  });
});
