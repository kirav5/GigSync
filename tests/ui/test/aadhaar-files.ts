import { createHash, webcrypto } from "node:crypto";
import { gzipSync } from "node:zlib";
import QRCode from "qrcode";
import {
  ekycXml,
  SignatureAlgorithm,
  spkiOf,
  uidaiChain,
  zipCryptoZip,
} from "../../../packages/core/test/ekyc-fixtures.js";

/**
 * Aadhaar files for the Get verified specs, signed with a test key the dev build trusts (adapters/idcheck.ts reads it
 * from localStorage under `import.meta.env.DEV` only): Offline e-KYC ZIPs (core's own test builders) and e-Aadhaar PDFs
 * holding a V2 Secure QR, password-locked as UIDAI's are (PDF Standard security, here revision 2, RC4 40-bit).
 */

/** Where the dev build looks for a test UIDAI key. */
export const DEV_KEY_STORAGE = "gigsync.dev.uidai_spki";
export const SHARE_CODE = "Ab3x";
/** The test Aadhaar ends in 6 (the reference id's 4th digit): UIDAI hashes its mobile 6 times. */
const REFERENCE_ID = "345620261116103000123";
const ROUNDS = 6;
const FIELD_END = 255;
const ADDRESS = ["W/O Ramesh Kumar", "Bengaluru Urban", "", "12", "Jayanagar", "560041", "Jayanagar", "Karnataka"];

export interface TestUidai {
  readonly key: CryptoKey;
  readonly spki: string;
}

export async function testUidai(): Promise<TestUidai> {
  const params = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  };
  const pair = (await webcrypto.subtle.generateKey(params, true, ["sign", "verify"])) as CryptoKeyPair;
  return { key: pair.privateKey, spki: await spkiOf(pair.publicKey) };
}

/** The 10 digits UIDAI hashes, from an E.164 Indian number. */
const national = (e164: string) => e164.replace(/^\+91/, "");

/** An e-KYC ZIP whose mobile hash is of `mobile` (E.164), or of none when undefined. */
export async function ekycZip(uidai: TestUidai, mobile: string | undefined): Promise<Buffer> {
  const mobileHash = mobile ? uidaiChain(`${national(mobile)}${SHARE_CODE}`, ROUNDS) : "";
  const xml = await ekycXml({ key: uidai.key, algorithm: SignatureAlgorithm.sha256, mobileHash });
  return Buffer.from(zipCryptoZip(xml, SHARE_CODE));
}

/** A V2 Secure QR's text: its fields, the mobile's last 4 digits, UIDAI's signature, gzipped, as one decimal number. */
export async function secureQrText(uidai: TestUidai, mobile: string): Promise<string> {
  const fields = [
    "V2",
    "2",
    REFERENCE_ID,
    "Lakshmi Devi",
    "15-08-1990",
    "F",
    ...ADDRESS,
    "",
    "",
    "",
    national(mobile).slice(-4),
  ];
  const payload = Buffer.from(fields.flatMap((f) => [...Buffer.from(f, "utf8"), FIELD_END]));
  const signature = Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", uidai.key, payload));
  return BigInt(`0x${gzipSync(Buffer.concat([payload, signature])).toString("hex")}`).toString();
}

/** RC4, as PDF's revision-2 security handler uses it. */
function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + (s[i] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
    out[n] = (data[n] ?? 0) ^ (s[((s[i] ?? 0) + (s[j] ?? 0)) & 0xff] ?? 0);
  }
  return out;
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
/** The PDF spec's 32-byte padding for passwords (ISO 32000-1, 7.6.3.3). */
const PAD = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
const padded = (password: string) => Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);
/** Permissions: print and copy allowed, as on an e-Aadhaar. */
const PERMISSIONS = -44;
const MODULE_PX = 4;
const QUIET_MODULES = 4;

/** The QR as an 8-bit grey image, `MODULE_PX` pixels a module, with its quiet zone. */
function qrImage(text: string): { size: number; pixels: Buffer } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = (modules.size + 2 * QUIET_MODULES) * MODULE_PX;
  const pixels = Buffer.alloc(size * size, 0xff);
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < MODULE_PX; dy++)
        pixels.fill(
          0,
          ((y + QUIET_MODULES) * MODULE_PX + dy) * size + (x + QUIET_MODULES) * MODULE_PX,
          ((y + QUIET_MODULES) * MODULE_PX + dy) * size + (x + QUIET_MODULES + 1) * MODULE_PX,
        );
    }
  return { size, pixels };
}

/** One A4 page holding the QR, locked with `password` (revision 2: RC4 with a 40-bit key). */
export function lockedPdf(qrText: string, password: string): Buffer {
  const id = createHash("md5").update(qrText).digest();
  const o = rc4(md5(padded(password)).subarray(0, 5), padded(password));
  const p = Buffer.alloc(4);
  p.writeInt32LE(PERMISSIONS);
  const fileKey = md5(padded(password), o, p, id).subarray(0, 5);
  const u = rc4(fileKey, PAD);
  const locked = (num: number, data: Buffer) =>
    rc4(md5(fileKey, Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0])).subarray(0, 10), data);
  const { size, pixels } = qrImage(qrText);
  const draw = Buffer.from("q 240 0 0 240 300 520 cm /Im1 Do Q");
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>",
    ),
    stream(
      `/Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceGray /BitsPerComponent 8`,
      locked(4, pixels),
    ),
    stream("", locked(5, draw)),
    Buffer.from(
      `<< /Filter /Standard /V 1 /R 2 /O <${o.toString("hex")}> /U <${u.toString("hex")}> /P ${PERMISSIONS} >>`,
    ),
  ];
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let at = parts[0]?.length ?? 0;
  objects.forEach((body, i) => {
    const object = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    offsets.push(at);
    parts.push(object);
    at += object.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
  ];
  const hexId = id.toString("hex");
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${hexId}> <${hexId}>] >>\nstartxref\n${at}\n%%EOF\n`;
  parts.push(Buffer.from(`${xref.join("\n")}\n${trailer}`));
  return Buffer.concat(parts);
}

function stream(dictionary: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
    data,
    Buffer.from("\nendstream"),
  ]);
}
