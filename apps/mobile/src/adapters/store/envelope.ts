/**
 * How one stored record is locked (ADR 0065): AES-256-GCM under the phone's storage key, a fresh random 96-bit IV per
 * write, and the record's place (its collection, which carries its owner, and its id) authenticated with it. A record
 * copied over another one, or into another owner's collection, fails to open instead of reading as theirs.
 *
 * What is kept: one byte of format version, the IV, then the ciphertext with its tag. Collection names and ids stay
 * in the clear as the database key: they are collection names, user ids and ULIDs, and say how many records of what
 * kind a phone holds and when each was made, never what is in them.
 */

const ALGORITHM = "AES-GCM";
const KEY_BITS = 256;
export const IV_BYTES = 12;
const FORMAT_VERSION = 1;
const HEADER_BYTES = 1 + IV_BYTES;
/** Domain separation: this key locks nothing but GigSync's stored records, format 1. */
const AAD_DOMAIN = "gigsync/store/v1";

export class EnvelopeError extends Error {}

/**
 * A new storage key that script can use and never read: `extractable: false`, so `exportKey` refuses, and IndexedDB
 * keeps it by structured clone without ever handing over its bytes.
 */
export function newStorageKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_BITS }, false, ["encrypt", "decrypt"]);
}

/** A JSON array, so no collection and id can be read as another pair (`a` + `b:c` is not `a:b` + `c`). */
const placeOf = (collection: string, id: string) =>
  new TextEncoder().encode(JSON.stringify([AAD_DOMAIN, collection, id]));

export async function seal(key: CryptoKey, collection: string, id: string, value: unknown): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const locked = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, additionalData: placeOf(collection, id) },
    key,
    plain,
  );
  const out = new Uint8Array(HEADER_BYTES + locked.byteLength);
  out[0] = FORMAT_VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(locked), HEADER_BYTES);
  return out;
}

/** Throws EnvelopeError when the record was altered, belongs somewhere else, or was locked with another key. */
export async function open(key: CryptoKey, collection: string, id: string, sealed: Uint8Array): Promise<unknown> {
  if (sealed[0] !== FORMAT_VERSION) throw new EnvelopeError("stored record has an unknown format");
  // Copies, so the IV and ciphertext sit in buffers of their own whatever `sealed` is a view of.
  const iv = sealed.slice(1, HEADER_BYTES);
  const locked = sealed.slice(HEADER_BYTES);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: ALGORITHM, iv, additionalData: placeOf(collection, id) }, key, locked);
  } catch {
    throw new EnvelopeError("stored record cannot be opened: altered, moved, or locked with another key");
  }
  return JSON.parse(new TextDecoder().decode(plain));
}
