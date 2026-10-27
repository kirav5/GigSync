import type { DeviceId } from "@gigsync/protocol";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { fromBase64, toBase64 } from "./base64.js";

/**
 * Sealing a body to a person's devices. A fresh content key encrypts the body once (XChaCha20-Poly1305); for each
 * recipient device, an X25519 agreement between a one-time key and the device's key, run through HKDF, wraps the
 * content key. The mailbox stores all of it and can read none of it.
 */

const KEY_BYTES = 32;
const NONCE_BYTES = 24;
/** Domain separation: these wrapping keys are for nothing but GigSync envelope bodies, version 1. */
const WRAP_INFO = utf8ToBytes("gigsync/seal/v1");

export class SealError extends Error {}

export interface Recipient {
  device: DeviceId;
  /** The device's registered X25519 public key, base64. */
  encryption_key: string;
}

export interface Sealed {
  epk: string;
  keys: Record<string, string>;
  ciphertext: string;
}

function encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES);
  return concatBytes(nonce, xchacha20poly1305(key, nonce).encrypt(plaintext));
}

function decrypt(key: Uint8Array, box: Uint8Array): Uint8Array {
  return xchacha20poly1305(key, box.subarray(0, NONCE_BYTES)).decrypt(box.subarray(NONCE_BYTES));
}

/** Binds each wrapping key to both public keys, so a wrapped key cannot be replayed to another device. */
function wrappingKey(shared: Uint8Array, epk: Uint8Array, recipientKey: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, concatBytes(epk, recipientKey), WRAP_INFO, KEY_BYTES);
}

export function seal(plaintext: Uint8Array, recipients: readonly Recipient[]): Sealed {
  if (recipients.length === 0) throw new SealError("no recipient devices");
  const ephemeral = x25519.utils.randomSecretKey();
  const epk = x25519.getPublicKey(ephemeral);
  const contentKey = randomBytes(KEY_BYTES);
  const keys: Record<string, string> = {};
  for (const r of recipients) {
    const theirs = fromBase64(r.encryption_key);
    const kek = wrappingKey(x25519.getSharedSecret(ephemeral, theirs), epk, theirs);
    keys[r.device] = toBase64(encrypt(kek, contentKey));
  }
  return { epk: toBase64(epk), keys, ciphertext: toBase64(encrypt(contentKey, plaintext)) };
}

/** Opens a body sealed to this device. Throws SealError when it was not sealed to it or was altered. */
export function open(sealed: Sealed, device: DeviceId, encryptionSecret: string): Uint8Array {
  const wrapped = sealed.keys[device];
  if (!wrapped) throw new SealError("not sealed to this device");
  try {
    const mine = fromBase64(encryptionSecret);
    const epk = fromBase64(sealed.epk);
    const kek = wrappingKey(x25519.getSharedSecret(mine, epk), epk, x25519.getPublicKey(mine));
    return decrypt(decrypt(kek, fromBase64(wrapped)), fromBase64(sealed.ciphertext));
  } catch {
    throw new SealError("cannot open: wrong key or altered envelope");
  }
}
