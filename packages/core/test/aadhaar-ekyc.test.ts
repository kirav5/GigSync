import { readFileSync } from "node:fs";
import { crc32 as crc } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { unzipEkyc, ZipProblem } from "../src/identity/ekyc-zip.js";
import { CardGender, checkAadhaarEkyc, IdCheckProblem, MobileBinding } from "../src/index.js";
import {
  ADDRESS,
  aesZip,
  ekycXml,
  keyParams,
  MOBILE_HASH,
  PHOTO,
  REFERENCE_ID,
  SignatureAlgorithm,
  spkiOf,
  uidaiChain,
  zipCryptoZip,
  zipOf,
} from "./ekyc-fixtures.js";

const NOW = new Date("2026-11-16T10:00:00.000Z");
const CODE = "Ab3x";
const KEPT = { name: "Lakshmi Devi", birthYear: 1990, gender: CardGender.female, aadhaarLast4: "3456" };
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));

const keys: Record<string, CryptoKeyPair> = {};
let other: CryptoKeyPair;
let spki: string[];

beforeAll(async () => {
  for (const algorithm of Object.values(SignatureAlgorithm))
    keys[algorithm.hash] = await crypto.subtle.generateKey(keyParams(algorithm.hash), true, ["sign", "verify"]);
  other = await crypto.subtle.generateKey(keyParams(SignatureAlgorithm.sha256.hash), true, ["sign", "verify"]);
  // Several keys, as UIDAI has: the check must try each.
  spki = await Promise.all(Object.values(keys).map((k) => spkiOf(k.publicKey)));
});

const signedBy = (algorithm: SignatureAlgorithm, key?: CryptoKey) =>
  ekycXml({ key: key ?? (keys[algorithm.hash] as CryptoKeyPair).privateKey, algorithm });
const check = (zip: Uint8Array<ArrayBuffer>, code = CODE) => checkAadhaarEkyc(zip, code, { spki, now: NOW });

describe("Aadhaar Offline e-KYC check", () => {
  for (const algorithm of Object.values(SignatureAlgorithm)) {
    it(`keeps only the name, year, gender, last 4 digits and time (RSA with ${algorithm.hash}, ZipCrypto)`, async () => {
      const result = await check(zipCryptoZip(await signedBy(algorithm), CODE));
      expect(result).toMatchObject({ ok: true, id: { ...KEPT, checkedAt: NOW.toISOString() } });
    });
  }

  it("opens a WinZip AES-256 ZIP too", async () => {
    const result = await check(aesZip(await signedBy(SignatureAlgorithm.sha1), CODE));
    expect(result).toMatchObject({ ok: true, id: { ...KEPT, checkedAt: NOW.toISOString() } });
  });

  it("carries no address, full reference, hash, photo or share code", async () => {
    const result = await check(zipCryptoZip(await signedBy(SignatureAlgorithm.sha256), CODE));
    const json = JSON.stringify(result);
    for (const leak of [...Object.values(ADDRESS), REFERENCE_ID, "15-08-1990", MOBILE_HASH, PHOTO, CODE])
      expect(json).not.toContain(leak);
  });

  it("says when the share code is wrong, for both ciphers", async () => {
    const xml = await signedBy(SignatureAlgorithm.sha256);
    const wrong = { ok: false, problem: IdCheckProblem.wrong_share_code };
    for (const code of ["Ab3y", "ab3x", "1234", "Ab3x5"]) {
      expect(await check(zipCryptoZip(xml, CODE), code)).toEqual(wrong);
      expect(await check(aesZip(xml, CODE), code)).toEqual(wrong);
    }
    expect(await check(zipCryptoZip(xml, CODE), "")).toEqual(wrong);
  });

  it("refuses a file whose name was changed after signing", async () => {
    const xml = (await signedBy(SignatureAlgorithm.sha256)).replace("Lakshmi Devi", "Lakshmi Dev1");
    expect(await check(zipCryptoZip(xml, CODE))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });

  it("refuses a file signed by anyone else", async () => {
    const forged = await signedBy(SignatureAlgorithm.sha256, other.privateKey);
    expect(await check(zipCryptoZip(forged, CODE))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });

  it("refuses a file with its signature taken out", async () => {
    const unsigned = (await signedBy(SignatureAlgorithm.sha256)).replace(/<Signature[\s\S]*<\/Signature>/, "");
    expect(await check(zipCryptoZip(unsigned, CODE))).toEqual({
      ok: false,
      problem: IdCheckProblem.signature_mismatch,
    });
  });

  it("refuses, without throwing, algorithm names or entities that are Object's own property names", async () => {
    const xml = await signedBy(SignatureAlgorithm.sha256);
    const odd = xml.replace(SignatureAlgorithm.sha256.uri, "constructor");
    expect(await check(zipCryptoZip(odd, CODE))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
    const digest = xml.replace(SignatureAlgorithm.sha256.digestUri, "toString");
    expect(await check(zipCryptoZip(digest, CODE))).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
    const entity = xml.replace("Lakshmi Devi", "&constructor;");
    expect(await check(zipCryptoZip(entity, CODE))).toEqual({ ok: false, problem: IdCheckProblem.not_ekyc_file });
  });

  it("refuses signed XML that is not an e-KYC file, and anything that is not its ZIP", async () => {
    const key = (keys[SignatureAlgorithm.sha256.hash] as CryptoKeyPair).privateKey;
    const otherXml = await ekycXml({ key, algorithm: SignatureAlgorithm.sha256, root: "Invoice" });
    const notEkyc = { ok: false, problem: IdCheckProblem.not_ekyc_file };
    expect(await check(zipCryptoZip(otherXml, CODE))).toEqual(notEkyc);
    expect(await check(zipCryptoZip("not xml at all", CODE))).toEqual(notEkyc);
    expect(await check(zipCryptoZip('<!DOCTYPE x [<!ENTITY a "b">]><x/>', CODE))).toEqual(notEkyc);
    expect(await check(new TextEncoder().encode("PK but not really a zip file"))).toEqual(notEkyc);
    expect(await check(zipCryptoZip(otherXml, CODE, "photo.jpg"))).toEqual(notEkyc);
  });

  it("refuses a signed e-KYC file whose Poi is not an Aadhaar holder's", async () => {
    const key = (keys[SignatureAlgorithm.sha256.hash] as CryptoKeyPair).privateKey;
    const blank = await ekycXml({ key, algorithm: SignatureAlgorithm.sha256, name: "" });
    expect(await check(zipCryptoZip(blank, CODE))).toEqual({ ok: false, problem: IdCheckProblem.not_aadhaar });
  });

  it("does not take a file signed by someone else as UIDAI's", async () => {
    const result = await checkAadhaarEkyc(zipCryptoZip(await signedBy(SignatureAlgorithm.sha1), CODE), CODE);
    expect(result).toEqual({ ok: false, problem: IdCheckProblem.signature_mismatch });
  });
});

describe("e-KYC ZIP", () => {
  const XML_START = '<?xml version="1.0" encoding="UTF-8"?>\n<OfflinePaperlessKyc';
  const text = (r: Awaited<ReturnType<typeof unzipEkyc>>) => (r.ok ? new TextDecoder().decode(r.xml) : r.problem);

  it("opens ZIPs made by Info-ZIP (ZipCrypto) and libarchive (WinZip AES-256)", async () => {
    for (const name of ["ekyc-infozip-zipcrypto.zip", "ekyc-libarchive-aes256.zip"]) {
      expect(text(await unzipEkyc(fixture(name), CODE))).toContain(XML_START);
      expect(text(await unzipEkyc(fixture(name), "Ab3X"))).toBe(ZipProblem.wrong_share_code);
    }
  });

  it("opens an unencrypted entry, and refuses an entry that is not one .xml file", async () => {
    const plain = new TextEncoder().encode("<x/>");
    const stored = zipOf({ method: 0, flags: 0, crc: crc(plain), data: plain }, plain.length);
    expect(text(await unzipEkyc(stored, CODE))).toBe("<x/>");
    const named = zipOf({ method: 0, flags: 0, crc: crc(plain), data: plain }, plain.length, "dir/a.xml");
    expect(text(await unzipEkyc(named, CODE))).toBe(ZipProblem.not_ekyc_zip);
  });
});

describe("Aadhaar Offline e-KYC mobile binding", () => {
  /** The reference id starts 3456: the Aadhaar ends in 6, so UIDAI hashes mobile + share code 6 times. */
  const PHONE = "+919876543210";
  const linked = uidaiChain(`9876543210${CODE}`, 6);
  const bind = async (mobileHash: string, phone = PHONE) => {
    const algorithm = SignatureAlgorithm.sha256;
    const xml = await ekycXml({ key: (keys[algorithm.hash] as CryptoKeyPair).privateKey, algorithm, mobileHash });
    const result = await checkAadhaarEkyc(zipCryptoZip(xml, CODE), CODE, { spki, now: NOW, phone });
    if (!result.ok) throw new Error(`refused: ${result.problem}`);
    return result;
  };

  it("binds the file when the signed-in number and the share code make UIDAI's hash", async () => {
    expect((await bind(linked)).binding).toBe(MobileBinding.matched);
    expect((await bind(linked.toUpperCase())).binding).toBe(MobileBinding.matched);
  });

  it("does not bind another number, but can check the right one typed after", async () => {
    const other = await bind(linked, "+919811000000");
    expect(other.binding).toBe(MobileBinding.not_matched);
    expect(await other.mobile.matches(PHONE)).toBe(MobileBinding.matched);
    expect(await other.mobile.matches("+919876543211")).toBe(MobileBinding.not_matched);
  });

  it("does not bind a hash made without the share code, or with too few rounds", async () => {
    expect((await bind(uidaiChain("9876543210", 6))).binding).toBe(MobileBinding.not_matched);
    expect((await bind(uidaiChain(`9876543210${CODE}`, 5))).binding).toBe(MobileBinding.not_matched);
  });

  it("says nothing is linked when m is empty", async () => {
    expect((await bind("")).binding).toBe(MobileBinding.not_linked);
  });

  it("never serializes the hash or the share code", async () => {
    const json = JSON.stringify(await bind(linked));
    for (const leak of [linked, CODE]) expect(json).not.toContain(leak);
  });
});
