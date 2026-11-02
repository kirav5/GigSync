import type { PushKeys } from "@gigsync/protocol";
import { fromB64url } from "./b64.js";

/**
 * Web Push message encryption (RFC 8291, the aes128gcm coding of RFC 8188): what an alert says is encrypted to the
 * phone's own push keys, so the push service carries bytes it cannot read. WebCrypto only.
 */

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const HKDF = "HKDF";
const SHA256 = "SHA-256";
const AES_GCM = "AES-GCM";
const RAW = "raw";
const BITS = 8;
/** RFC 8291 §3.4: the input keying material, the content key and the nonce, in bytes. */
const IKM_BYTES = 32;
const CEK_BYTES = 16;
const NONCE_BYTES = 12;
const SALT_BYTES = 16;
/** One record holds the whole alert: the record size only has to exceed it (RFC 8188 §2). */
const RECORD_SIZE = 4096;
/** The padding delimiter of the last (and only) record. */
const LAST_RECORD = 2;
const POINT_BYTES = 65;
/** RFC 8188 §2.1: the record size is a 4-byte number, then one byte gives the sender key's length. */
const RS_BYTES = 4;
const HEADER_BYTES = SALT_BYTES + RS_BYTES + 1;

const text = (s: string) => new TextEncoder().encode(s);
const join = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(RAW, join(ikm), HKDF, false, ["deriveBits"]);
  const params = { name: HKDF, hash: SHA256, salt: join(salt), info: join(info) };
  return new Uint8Array(await crypto.subtle.deriveBits(params, key, bytes * BITS));
}

/** The body of one push carrying `plain`, encrypted to `keys`; send it with `Content-Encoding: aes128gcm`. */
export async function encryptPush(plain: Uint8Array, keys: PushKeys): Promise<Uint8Array<ArrayBuffer>> {
  const phonePoint = fromB64url(keys.p256dh);
  const authSecret = fromB64url(keys.auth);
  const phoneKey = await crypto.subtle.importKey(RAW, join(phonePoint), ECDH, false, []);
  const mine = (await crypto.subtle.generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const myPoint = new Uint8Array((await crypto.subtle.exportKey(RAW, mine.publicKey)) as ArrayBuffer);
  // WebCrypto's ECDH parameter is `public`; the Workers types spell it `$public` (a reserved word in their generator).
  const ecdh = { name: ECDH.name, public: phoneKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, mine.privateKey, IKM_BYTES * BITS));
  // RFC 8291 §3.4: the shared secret and the phone's auth secret make the keying material for this one message.
  const ikm = await hkdf(authSecret, shared, join(text("WebPush: info\0"), phonePoint, myPoint), IKM_BYTES);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), CEK_BYTES);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), NONCE_BYTES);
  const aes = await crypto.subtle.importKey(RAW, join(cek), AES_GCM, false, ["encrypt"]);
  const sealed = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: join(nonce) },
    aes,
    join(plain, Uint8Array.of(LAST_RECORD)),
  );
  // RFC 8188 §2.1: salt, record size, the sender's key, then the one record.
  const header = new Uint8Array(HEADER_BYTES);
  header.set(salt);
  new DataView(header.buffer).setUint32(SALT_BYTES, RECORD_SIZE);
  header[SALT_BYTES + RS_BYTES] = POINT_BYTES;
  return join(header, myPoint, new Uint8Array(sealed));
}
