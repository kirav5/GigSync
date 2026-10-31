/** Standard base64 for bytes, via btoa/atob, which phones, Node and Workers all have. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const PADDING = /=+$/;

/** Base64url without padding (RFC 4648 §5), for text that travels in a QR code or a URL. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(PADDING, "").replaceAll("+", "-").replaceAll("/", "_");
}

export function fromBase64Url(text: string): Uint8Array {
  const standard = text.replaceAll("-", "+").replaceAll("_", "/");
  return fromBase64(standard.padEnd(Math.ceil(standard.length / 4) * 4, "="));
}
