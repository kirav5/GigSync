/**
 * Test-only builders for Aadhaar Paperless Offline e-KYC files: a signed XML laid out as UIDAI's, and ZIPs locked
 * with a share code by ZipCrypto or WinZip AES-256. Built with Node's own crypto and zlib, independently of the code
 * under test, and with the canonical XML written out by hand (not by core's c14n), so a passing check means the two
 * agree rather than that one function agrees with itself.
 */
import { createCipheriv, createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { crc32, deflateRawSync } from "node:zlib";

export const DSIG = "http://www.w3.org/2000/09/xmldsig#";
export const SignatureAlgorithm = {
  sha1: { uri: `${DSIG}rsa-sha1`, hash: "SHA-1", digestUri: `${DSIG}sha1` },
  sha256: {
    uri: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    hash: "SHA-256",
    digestUri: "http://www.w3.org/2001/04/xmlenc#sha256",
  },
} as const;
export type SignatureAlgorithm = (typeof SignatureAlgorithm)[keyof typeof SignatureAlgorithm];
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENVELOPED = `${DSIG}enveloped-signature`;

export const PERSON = { name: "Lakshmi Devi", dob: "15-08-1990", gender: "F" };
export const REFERENCE_ID = "345620261116103000123";
export const ADDRESS = { careof: "W/O Ramesh Kumar", house: "12", street: "4th Main", pc: "560041" };
export const PHOTO = "/9j/4AAQSkZJRgABAQAAAQABAAD/PHOTO";
export const MOBILE_HASH = "a".repeat(64);
export const ENTRY_NAME = "offlineaadhaar20261116103000123.xml";

/**
 * UIDAI's mobile hash, made with Node's own crypto, independently of core's: SHA-256 `rounds` times (at least once),
 * each over the lowercase hex of the one before.
 */
export function uidaiChain(text: string, rounds: number): string {
  let value = text;
  for (let round = 0; round < Math.max(1, rounds); round++) value = createHash("sha256").update(value).digest("hex");
  return value;
}

const b64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(new Uint8Array(bytes)).toString("base64");

export interface EkycXmlOptions {
  readonly key: CryptoKey;
  readonly algorithm: SignatureAlgorithm;
  readonly root?: string;
  readonly name?: string;
  /** The Poi `m` attribute: UIDAI's hex hash of the mobile and share code, or "" when no mobile is linked. */
  readonly mobileHash?: string;
}

/**
 * A signed e-KYC XML as UIDAI's file is written (declaration, CRLF, a self-closing Poa, Poi attributes out of order),
 * with the digest and the signature made over the canonical forms written here by hand.
 */
export async function ekycXml({
  key,
  algorithm,
  root = "OfflinePaperlessKyc",
  name = PERSON.name,
  mobileHash = MOBILE_HASH,
}: EkycXmlOptions) {
  const poi = (canonical: boolean) =>
    canonical
      ? `<Poi dob="${PERSON.dob}" e="" gender="${PERSON.gender}" m="${mobileHash}" name="${name}"></Poi>`
      : `<Poi name='${name}' dob="${PERSON.dob}"\n gender="${PERSON.gender}" e="" m="${mobileHash}"/>`;
  const poa = `careof="${ADDRESS.careof}" house="${ADDRESS.house}" pc="${ADDRESS.pc}" street="${ADDRESS.street}"`;
  const data = (selfClosing: boolean) =>
    `<UidData>${poi(!selfClosing)}<Poa ${poa}${selfClosing ? " />" : "></Poa>"}<Pht>${PHOTO}</Pht></UidData>`;
  const canonicalDocument = `<${root} referenceId="${REFERENCE_ID}">\n${data(false)}\n</${root}>`;
  const digest = b64(await crypto.subtle.digest(algorithm.hash, new TextEncoder().encode(canonicalDocument)));
  const signedInfo = (ns: string) =>
    `<SignedInfo${ns}><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${algorithm.uri}"></SignatureMethod><Reference URI=""><Transforms>` +
    `<Transform Algorithm="${ENVELOPED}"></Transform></Transforms><DigestMethod Algorithm="${algorithm.digestUri}">` +
    `</DigestMethod><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const canonicalSignedInfo = new TextEncoder().encode(signedInfo(` xmlns="${DSIG}"`));
  const value = b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, canonicalSignedInfo));
  const wrapped = value.replace(/(.{76})/g, "$1\n");
  const signature = `<Signature xmlns="${DSIG}">${signedInfo("")}<SignatureValue>${wrapped}</SignatureValue></Signature>`;
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n<${root} referenceId="${REFERENCE_ID}">\n${data(true)}\n${signature}</${root}>\n`;
  return file.replace(/\n/g, "\r\n");
}

export const keyParams = (hash: string) => ({
  name: "RSASSA-PKCS1-v1_5",
  hash,
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
});

export async function spkiOf(key: CryptoKey): Promise<string> {
  return b64(await crypto.subtle.exportKey("spki", key));
}

interface Packed {
  readonly method: number;
  readonly flags: number;
  readonly crc: number;
  readonly data: Uint8Array;
  readonly extra?: Uint8Array;
}

/** A one-entry ZIP: local header, data, central directory, end record. */
export function zipOf(packed: Packed, size: number, name = ENTRY_NAME): Uint8Array<ArrayBuffer> {
  const nameBytes = Buffer.from(name, "latin1");
  const extra = Buffer.from(packed.extra ?? new Uint8Array());
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(51, 4);
  local.writeUInt16LE(packed.flags, 6);
  local.writeUInt16LE(packed.method, 8);
  local.writeUInt32LE(packed.crc, 14);
  local.writeUInt32LE(packed.data.length, 18);
  local.writeUInt32LE(size, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(extra.length, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(51, 4);
  central.writeUInt16LE(51, 6);
  central.writeUInt16LE(packed.flags, 8);
  central.writeUInt16LE(packed.method, 10);
  central.writeUInt32LE(packed.crc, 16);
  central.writeUInt32LE(packed.data.length, 20);
  central.writeUInt32LE(size, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(extra.length, 30);
  central.writeUInt32LE(0, 42);
  const body = Buffer.concat([local, nameBytes, extra, packed.data]);
  const directory = Buffer.concat([central, nameBytes, extra]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  return new Uint8Array(Buffer.concat([body, directory, end]));
}

/** The traditional PKWARE cipher (APPNOTE 6.1), encrypting: the key update takes each plaintext byte. */
function zipCryptoEncrypt(plain: Uint8Array, password: string, check: number): Uint8Array {
  const crcByte = (crc: number, byte: number) =>
    (crc32(Buffer.from([byte]), (crc ^ 0xffffffff) >>> 0) ^ 0xffffffff) >>> 0;
  let k0 = 0x12345678;
  let k1 = 0x23456789;
  let k2 = 0x34567890;
  const update = (byte: number) => {
    k0 = crcByte(k0, byte);
    k1 = (Math.imul((k1 + (k0 & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    k2 = crcByte(k2, k1 >>> 24);
  };
  for (const byte of Buffer.from(password, "utf8")) update(byte);
  const header = randomBytes(12);
  header[11] = check;
  const input = Buffer.concat([header, plain]);
  return Uint8Array.from(input, (byte) => {
    const temp = (k2 | 2) & 0xffff;
    const out = byte ^ ((Math.imul(temp, temp ^ 1) >>> 8) & 0xff);
    update(byte);
    return out;
  });
}

export function zipCryptoZip(text: string, password: string, name?: string): Uint8Array<ArrayBuffer> {
  const plain = Buffer.from(text, "utf8");
  const crc = crc32(plain);
  const data = zipCryptoEncrypt(deflateRawSync(plain), password, crc >>> 24);
  return zipOf({ method: 8, flags: 1, crc, data }, plain.length, name);
}

/** WinZip AE-2 with AES-256: salt, password check, AES-CTR (little-endian counter from 1), HMAC-SHA1's first 10. */
export function aesZip(text: string, password: string): Uint8Array<ArrayBuffer> {
  const plain = Buffer.from(text, "utf8");
  const packed = deflateRawSync(plain);
  const salt = randomBytes(16);
  const keys = pbkdf2Sync(password, salt, 1000, 66, "sha1");
  const ecb = createCipheriv("aes-256-ecb", keys.subarray(0, 32), null).setAutoPadding(false);
  const cipher = Buffer.alloc(packed.length);
  for (let block = 0; block * 16 < packed.length; block++) {
    const counter = Buffer.alloc(16);
    counter.writeUInt32LE(block + 1, 0);
    const stream = ecb.update(counter);
    for (let i = 0; i < 16 && block * 16 + i < packed.length; i++)
      cipher[block * 16 + i] = (packed[block * 16 + i] ?? 0) ^ (stream[i] ?? 0);
  }
  const mac = createHmac("sha1", keys.subarray(32, 64)).update(cipher).digest().subarray(0, 10);
  const extra = Buffer.from([0x01, 0x99, 7, 0, 2, 0, 0x41, 0x45, 3, 8, 0]);
  const data = Buffer.concat([salt, keys.subarray(64, 66), cipher, mac]);
  return zipOf({ method: 99, flags: 1, crc: 0, data, extra }, plain.length);
}
