/** Turning the text of an Aadhaar Secure QR (one long decimal number) back into the bytes UIDAI signed, and unzipping. */

/** Digits in the biggest Secure QR we accept: a QR code holds under 3 KB, which is about 7,100 decimal digits. */
export const MAX_QR_DIGITS = 8000;
/** Bytes the unzipped data may reach: real cards unzip to a few KB; more is a zip bomb, not an Aadhaar. */
export const MAX_UNZIPPED_BYTES = 64 * 1024;

const DECIMAL = /^\d+$/;
const HEX_RADIX = 16;
const HEX_PAIR = 2;

/** The big-endian bytes of a decimal number, or undefined when the text is not one (or is too long to be a QR). */
export function decimalBytes(text: string): Uint8Array<ArrayBuffer> | undefined {
  const digits = text.trim();
  if (!DECIMAL.test(digits) || digits.length > MAX_QR_DIGITS) return undefined;
  const hex = BigInt(digits).toString(HEX_RADIX);
  const even = hex.length % HEX_PAIR ? `0${hex}` : hex;
  const bytes = new Uint8Array(even.length / HEX_PAIR);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(even.slice(i * HEX_PAIR, (i + 1) * HEX_PAIR), HEX_RADIX);
  return bytes;
}

/** Whether two byte strings are equal, in time that does not depend on where they first differ. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** The gunzipped bytes, or undefined when they are not gzip or unzip past `MAX_UNZIPPED_BYTES`. */
export function gunzip(zipped: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | undefined> {
  return inflate(zipped, "gzip", MAX_UNZIPPED_BYTES);
}

/**
 * The bytes decompressed from `format` (a Secure QR's gzip, a ZIP entry's raw deflate), or undefined when they are
 * not that format or grow past `maxBytes`: a zip bomb is refused before it fills the phone's memory.
 */
export async function inflate(
  packed: Uint8Array<ArrayBuffer>,
  format: CompressionFormat,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      size += read.value.length;
      if (size > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(read.value);
    }
  } catch {
    return undefined;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
    chunk.fill(0);
  }
  return out;
}
