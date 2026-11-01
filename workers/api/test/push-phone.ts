import { b64url, fromB64url } from "../src/push/b64.js";

/**
 * A phone's side of Web Push encryption (RFC 8291), for tests: its keys as a browser hands them out, and decrypting a
 * push body the way the browser does before the service worker sees it.
 */

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const HKDF = "HKDF";
const enc = (s: string) => new TextEncoder().encode(s);
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, HKDF, false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: HKDF, hash: "SHA-256", salt, info }, key, bytes * 8));
}

export interface TestPhone {
  keys: { p256dh: string; auth: string };
  decrypt(body: Uint8Array): Promise<string>;
}

export async function testPhone(): Promise<TestPhone> {
  const pair = (await crypto.subtle.generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const point = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    keys: { p256dh: b64url(point), auth: b64url(auth) },
    async decrypt(body) {
      const salt = body.slice(0, 16);
      const idLength = body[20] ?? 0;
      const senderPoint = body.slice(21, 21 + idLength);
      const sealed = body.slice(21 + idLength);
      const sender = await crypto.subtle.importKey("raw", senderPoint, ECDH, false, []);
      const ecdh = { name: "ECDH", public: sender } as unknown as SubtleCryptoDeriveKeyAlgorithm;
      const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, pair.privateKey, 256));
      const ikm = await hkdf(fromB64url(b64url(auth)), shared, join(enc("WebPush: info\0"), point, senderPoint), 32);
      const cek = await hkdf(salt, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
      const nonce = await hkdf(salt, ikm, enc("Content-Encoding: nonce\0"), 12);
      const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, sealed));
      // The last byte is the record delimiter (2: last record).
      if (plain.at(-1) !== 2) throw new Error("not a last record");
      return new TextDecoder().decode(plain.slice(0, -1));
    },
  };
}
