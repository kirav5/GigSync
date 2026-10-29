import { toBase64 } from "@gigsync/crypto";
import type { LinkCode } from "@gigsync/protocol";

/** A colleague code is 16 random bytes: too many to guess in the ten minutes it lives. */
const LINK_CODE_BYTES = 16;
const URL_UNSAFE = /[+/]/g;
const BASE64URL: Readonly<Record<string, string>> = { "+": "-", "/": "_" };
const PADDING = /=+$/;

/** A fresh single-use colleague code, base64url without padding (the shape `LinkCode` checks). */
export function newLinkCode(): LinkCode {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_BYTES));
  return toBase64(bytes)
    .replace(URL_UNSAFE, (c) => BASE64URL[c] ?? c)
    .replace(PADDING, "");
}

/** Compares two codes in constant time: the comparison guards a link, so it must not leak how much matched. */
export function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
