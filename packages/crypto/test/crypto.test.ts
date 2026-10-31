import type { DeviceId, JobTerms } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  fromBase64,
  newDeviceSecrets,
  open,
  publicKeysOf,
  SealError,
  seal,
  sign,
  termsHash,
  toBase64,
  verify,
} from "../src/index.js";

const ULID = "01J0000000000000000000AAAA";
const phone = { device: `dev_${ULID.replace("AAAA", "PHON")}` as DeviceId, secrets: newDeviceSecrets() };
const tablet = { device: `dev_${ULID.replace("AAAA", "TABL")}` as DeviceId, secrets: newDeviceSecrets() };
const stranger = { device: `dev_${ULID.replace("AAAA", "STRA")}` as DeviceId, secrets: newDeviceSecrets() };
const to = (d: typeof phone) => ({ device: d.device, encryption_key: publicKeysOf(d.secrets).encryption_key });
const text = (b: Uint8Array) => new TextDecoder().decode(b);
const body = new TextEncoder().encode(JSON.stringify({ contact: { phone: "+919800000101" } }));

describe("seal and open", () => {
  it("every recipient device opens the same body", () => {
    const sealed = seal(body, [to(phone), to(tablet)]);
    expect(text(open(sealed, phone.device, phone.secrets.encryption))).toBe(text(body));
    expect(text(open(sealed, tablet.device, tablet.secrets.encryption))).toBe(text(body));
  });
  it("the sealed form does not contain the plaintext", () => {
    const sealed = seal(body, [to(phone)]);
    expect(JSON.stringify(sealed)).not.toContain("9800000101");
    expect(text(fromBase64(sealed.ciphertext))).not.toContain("9800000101");
  });
  it("a device it was not sealed to cannot open it, even with a copied key slot", () => {
    const sealed = seal(body, [to(phone)]);
    expect(() => open(sealed, stranger.device, stranger.secrets.encryption)).toThrow(SealError);
    const copied = { ...sealed, keys: { [stranger.device]: sealed.keys[phone.device] as string } };
    expect(() => open(copied, stranger.device, stranger.secrets.encryption)).toThrow(SealError);
  });
  it("an altered ciphertext fails to open", () => {
    const sealed = seal(body, [to(phone)]);
    const bytes = fromBase64(sealed.ciphertext);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 1;
    expect(() => open({ ...sealed, ciphertext: toBase64(bytes) }, phone.device, phone.secrets.encryption)).toThrow(
      SealError,
    );
  });
  it("refuses to seal to nobody", () => {
    expect(() => seal(body, [])).toThrow(SealError);
  });
});

describe("signatures", () => {
  const keys = publicKeysOf(phone.secrets);
  it("verifies with the matching public key only", () => {
    const sig = toBase64(sign(body, phone.secrets.signing));
    expect(verify(body, sig, keys.signing_key)).toBe(true);
    expect(verify(body, sig, publicKeysOf(stranger.secrets).signing_key)).toBe(false);
    expect(verify(new Uint8Array([1, 2]), sig, keys.signing_key)).toBe(false);
  });
  it("returns false for garbage instead of throwing", () => {
    expect(verify(body, "not-base64!", keys.signing_key)).toBe(false);
  });
});

describe("terms hash", () => {
  const terms: JobTerms = {
    engagement: `eng_${ULID}`,
    offer_id: `off_${ULID}`,
    worker: `usr_${ULID}`,
    consumer: `usr_${ULID.replace("AAAA", "BBBB")}`,
    trade: "electrician",
    scope: "Replace fan capacitor",
    slot: "tomorrow 10:00",
    price_paise: 65000,
  };
  it("is stable regardless of key order and changes with any term", () => {
    const reordered = Object.fromEntries(Object.entries(terms).reverse()) as JobTerms;
    expect(termsHash(reordered)).toBe(termsHash(terms));
    expect(termsHash({ ...terms, price_paise: 6500 })).not.toBe(termsHash(terms));
    expect(termsHash(terms)).toMatch(/^[0-9a-f]{64}$/);
  });
});
