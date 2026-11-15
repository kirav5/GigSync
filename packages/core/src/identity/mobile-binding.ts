import { sameBytes } from "./qr-bytes.js";

/**
 * Whether the mobile number linked to an Aadhaar is one the person holds, by UIDAI's published rules (see
 * docs/setup/uidai-secure-qr-key.md, "Binding to the person"):
 * - Offline e-KYC XML, Poi `m`: hex SHA-256 over (mobile + share code), repeated as many times as the last digit of the
 *   Aadhaar number; 0 or 1 hashes once (https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc).
 * - Secure QR, older layout: the same over the mobile alone, kept as 32 raw bytes before the signature (UIDAI's Secure
 *   QR reader manual, as the open-source readers implement it).
 * - Secure QR, versioned layout ("V2" and later): no hash, the mobile's last 4 digits in plain text.
 * Each round hashes the lowercase hex text of the round before. "Mobile" is the 10-digit Indian number, no +91.
 */

/** How a candidate number compares with the one linked to the Aadhaar. */
export const MobileBinding = {
  /** The whole number matches UIDAI's hash. */
  matched: "matched",
  /** The last 4 digits match (versioned Secure QR, which carries nothing more). */
  matched_last4: "matched_last4",
  not_matched: "not_matched",
  /** The Aadhaar has no mobile number linked, so nothing can match. */
  not_linked: "not_linked",
} as const;
export type MobileBinding = (typeof MobileBinding)[keyof typeof MobileBinding];

/** Which number bound the Aadhaar to its holder: the one they signed in with, or another they proved by SMS code. */
export const BoundBy = { signed_in: "signed_in", second_number: "second_number" } as const;
export type BoundBy = (typeof BoundBy)[keyof typeof BoundBy];

/** Whether a binding lets the check go on to "is this your own Aadhaar?". */
export const bindingFits = (binding: MobileBinding): boolean =>
  binding === MobileBinding.matched || binding === MobileBinding.matched_last4;

/** India's dialling code as E.164 writes it; an Aadhaar's mobile is always an Indian one. */
const INDIA_PREFIX = "+91";
const INDIAN_MOBILE = /^\d{10}$/;
const HEX = /^[0-9a-f]{64}$/;
const LAST_4 = /^\d{4}$/;
const SHA_256 = "SHA-256";
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const LAST_4_LENGTH = 4;
const MIN_ROUNDS = 1;
const utf8 = new TextEncoder();

/** The 10-digit number UIDAI hashes, from an E.164 one, or undefined when it is not an Indian mobile. */
export function aadhaarMobile(e164: string): string | undefined {
  if (!e164.startsWith(INDIA_PREFIX)) return undefined;
  const national = e164.slice(INDIA_PREFIX.length);
  return INDIAN_MOBILE.test(national) ? national : undefined;
}

/** How many times UIDAI hashes: the last digit of the Aadhaar number, at least once. */
export function hashRounds(aadhaarLast4: string): number {
  const digit = Number(aadhaarLast4.charAt(LAST_4_LENGTH - 1));
  return Number.isInteger(digit) ? Math.max(MIN_ROUNDS, digit) : MIN_ROUNDS;
}

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(HEX_RADIX).padStart(HEX_PAIR, "0")).join("");

/** UIDAI's chain: SHA-256 `rounds` times, each over the lowercase hex of the one before; returns the last as hex. */
export async function chainedSha256(text: string, rounds: number): Promise<string> {
  let value = text;
  for (let round = 0; round < Math.max(MIN_ROUNDS, rounds); round++)
    value = hex(await crypto.subtle.digest(SHA_256, utf8.encode(value)));
  return value;
}

/** A hash as bytes, from UIDAI's hex text, or undefined when it is not 64 hex digits. */
export function hashFromHex(text: string): Uint8Array | undefined {
  const lower = text.trim().toLowerCase();
  if (!HEX.test(lower)) return undefined;
  return Uint8Array.from({ length: lower.length / HEX_PAIR }, (_, i) =>
    Number.parseInt(lower.slice(i * HEX_PAIR, (i + 1) * HEX_PAIR), HEX_RADIX),
  );
}

/** What a checked Aadhaar holds about its mobile: a hash (with what is added before hashing), the last 4, or nothing. */
type Evidence =
  | { readonly hash: Uint8Array; readonly suffix: string; readonly rounds: number }
  | { readonly last4: string }
  | undefined;

/**
 * The mobile evidence of one checked Aadhaar, held only in memory for the length of the check, in private fields
 * that never serialize, log or reach storage. It answers one question, for any number the holder types.
 */
export class MobileEvidence {
  readonly #evidence: Evidence;

  private constructor(evidence: Evidence) {
    this.#evidence = evidence;
  }

  /** A hash UIDAI made of the mobile and `suffix` (the e-KYC share code, or nothing on a Secure QR). */
  static hashed(hash: Uint8Array | undefined, suffix: string, aadhaarLast4: string): MobileEvidence {
    return new MobileEvidence(
      hash ? { hash: Uint8Array.from(hash), suffix, rounds: hashRounds(aadhaarLast4) } : undefined,
    );
  }

  /** The last 4 digits a versioned Secure QR prints; nothing linked when the field is empty. */
  static lastFour(last4: string): MobileEvidence {
    const digits = last4.trim();
    return new MobileEvidence(LAST_4.test(digits) ? { last4: digits } : undefined);
  }

  /** How `e164` (a number in the international form) compares with the Aadhaar's mobile. */
  async matches(e164: string | undefined): Promise<MobileBinding> {
    const evidence = this.#evidence;
    if (!evidence) return MobileBinding.not_linked;
    const mobile = e164 === undefined ? undefined : aadhaarMobile(e164);
    if (!mobile) return MobileBinding.not_matched;
    if ("last4" in evidence)
      return mobile.endsWith(evidence.last4) ? MobileBinding.matched_last4 : MobileBinding.not_matched;
    const made = hashFromHex(await chainedSha256(`${mobile}${evidence.suffix}`, evidence.rounds));
    return made && sameBytes(made, evidence.hash) ? MobileBinding.matched : MobileBinding.not_matched;
  }
}
