/**
 * WinZip AES (AE-1 and AE-2), decrypt only, with WebCrypto: the stronger of the two ways a UIDAI e-KYC ZIP can be
 * locked with its share code. Per WinZip's "AES Encryption Information" spec: the entry's data is a salt, a 2-byte
 * password check, the AES-CTR ciphertext and a 10-byte HMAC-SHA1 of the ciphertext; the keys come from PBKDF2-HMAC-SHA1
 * with 1000 rounds over the password and salt.
 */
import { sameBytes } from "./qr-bytes.js";

/** The 0x9901 extra field's strength byte: 1, 2 or 3 for AES-128, -192 or -256. */
const STRENGTHS: Readonly<Record<number, { readonly keyBytes: number; readonly saltBytes: number }>> = {
  1: { keyBytes: 16, saltBytes: 8 },
  2: { keyBytes: 24, saltBytes: 12 },
  3: { keyBytes: 32, saltBytes: 16 },
};
const PBKDF2_ROUNDS = 1000;
const CHECK_BYTES = 2;
const MAC_BYTES = 10;
const BLOCK = 16;
const BITS_PER_BYTE = 8;
const BYTE = 0xff;
const SHA1 = "SHA-1";
const AES_CTR = "AES-CTR";
const RAW = "raw";

/** Why WinZip AES data did not open: the share code is wrong, or the data is not laid out as WinZip AES. */
export const AesProblem = { wrong_password: "wrong_password", malformed: "malformed" } as const;
export type AesProblem = (typeof AesProblem)[keyof typeof AesProblem];

export type AesOpened =
  | { readonly ok: true; readonly bytes: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly problem: AesProblem };

/** The data of a WinZip AES entry, decrypted with `password`, once its password check and HMAC both match. */
export async function zipAesDecrypt(sealed: Uint8Array, strength: number, password: Uint8Array): Promise<AesOpened> {
  const sizes = STRENGTHS[strength];
  if (!sizes || sealed.length < sizes.saltBytes + CHECK_BYTES + MAC_BYTES)
    return { ok: false, problem: AesProblem.malformed };
  const salt = sealed.slice(0, sizes.saltBytes);
  const check = sealed.subarray(sizes.saltBytes, sizes.saltBytes + CHECK_BYTES);
  const cipher = sealed.slice(sizes.saltBytes + CHECK_BYTES, sealed.length - MAC_BYTES);
  const mac = sealed.subarray(sealed.length - MAC_BYTES);

  const base = await crypto.subtle.importKey(RAW, new Uint8Array(password), "PBKDF2", false, ["deriveBits"]);
  const bits = (sizes.keyBytes * 2 + CHECK_BYTES) * BITS_PER_BYTE;
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: SHA1 }, base, bits),
  );
  try {
    const aesKey = derived.slice(0, sizes.keyBytes);
    const macKey = derived.slice(sizes.keyBytes, sizes.keyBytes * 2);
    if (!sameBytes(derived.subarray(sizes.keyBytes * 2), check))
      return { ok: false, problem: AesProblem.wrong_password };
    const hmac = await crypto.subtle.importKey(RAW, macKey, { name: "HMAC", hash: SHA1 }, false, ["sign"]);
    macKey.fill(0);
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", hmac, cipher));
    if (!sameBytes(signed.subarray(0, MAC_BYTES), mac)) return { ok: false, problem: AesProblem.wrong_password };
    const key = await crypto.subtle.importKey(RAW, aesKey, AES_CTR, false, ["encrypt"]);
    aesKey.fill(0);
    return { ok: true, bytes: await ctrLittleEndian(key, cipher) };
  } finally {
    derived.fill(0);
  }
}

/**
 * AES-CTR as WinZip does it: the counter is the whole 16-byte block, little-endian, starting at 1. WebCrypto counts
 * big-endian, so each block's keystream is asked for on its own, with its counter as the whole block.
 */
async function ctrLittleEndian(key: CryptoKey, cipher: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const blocks = Math.ceil(cipher.length / BLOCK);
  const plain = await Promise.all(
    Array.from({ length: blocks }, async (_, n) => {
      const counter = new Uint8Array(BLOCK);
      for (let value = n + 1, at = 0; value > 0; value = Math.floor(value / (BYTE + 1)), at++)
        counter[at] = value & BYTE;
      const part = cipher.subarray(n * BLOCK, (n + 1) * BLOCK);
      const algorithm = { name: AES_CTR, counter, length: BLOCK * BITS_PER_BYTE };
      return new Uint8Array(await crypto.subtle.encrypt(algorithm, key, part));
    }),
  );
  const out = new Uint8Array(cipher.length);
  plain.forEach((part, n) => {
    out.set(part, n * BLOCK);
    part.fill(0);
  });
  return out;
}
