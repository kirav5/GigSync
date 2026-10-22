const encoder = new TextEncoder();
const HASH = "SHA-256";
const HMAC = "HMAC";

export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: HMAC, hash: HASH }, false, ["sign"]);
  const sig = await crypto.subtle.sign(HMAC, k, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two secrets in constant time. Both are hashed first, so different lengths leak nothing either. */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest(HASH, encoder.encode(a)),
    crypto.subtle.digest(HASH, encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}
