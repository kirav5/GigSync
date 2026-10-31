import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * A box: bytes locked with a one-time symmetric key (XChaCha20-Poly1305, the cipher envelopes use), for data handed
 * over with its key out of band, as a phone moving its owner's records to their new phone shows the key in a QR code.
 * The context (what the box is for, and whose) is authenticated with it: a box opened for the wrong owner fails.
 */

export const BOX_KEY_BYTES = 32;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;
/** How many bytes a box adds to what it locks: the nonce before and the tag after. */
export const BOX_OVERHEAD_BYTES = NONCE_BYTES + TAG_BYTES;

export class BoxError extends Error {}

/** A fresh key from the platform's cryptographic source. */
export function newBoxKey(): Uint8Array {
  return randomBytes(BOX_KEY_BYTES);
}

function checked(key: Uint8Array): Uint8Array {
  if (key.length !== BOX_KEY_BYTES) throw new BoxError("box key must be 32 bytes");
  return key;
}

export function lockBox(key: Uint8Array, plaintext: Uint8Array, context: string): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES);
  return concatBytes(nonce, xchacha20poly1305(checked(key), nonce, utf8ToBytes(context)).encrypt(plaintext));
}

/** Throws BoxError when the key or the context is wrong, or the box was altered. */
export function openBox(key: Uint8Array, box: Uint8Array, context: string): Uint8Array {
  checked(key);
  try {
    const cipher = xchacha20poly1305(key, box.subarray(0, NONCE_BYTES), utf8ToBytes(context));
    return cipher.decrypt(box.subarray(NONCE_BYTES));
  } catch {
    throw new BoxError("cannot open box: wrong key or context, or altered");
  }
}
