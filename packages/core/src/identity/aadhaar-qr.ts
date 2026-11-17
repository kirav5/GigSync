import { type CardFields, readCard } from "./card-fields.js";
import type { MobileBinding, MobileEvidence } from "./mobile-binding.js";
import { decimalBytes, gunzip } from "./qr-bytes.js";
import { importSpki, SECURE_QR_SIGNATURE, uidaiKeys } from "./uidai-key.js";

/** Bytes in UIDAI's RSA-2048 signature, at the very end of the unzipped data. */
export const SIGNATURE_BYTES = 256;

/** Why a scanned code was not accepted as a checked Aadhaar. The screen shows the matching `idcheck.*` line. */
export const IdCheckProblem = {
  /** The QR text is not one long decimal number, so not a Secure QR at all: `idcheck.not_aadhaar`. */
  not_a_number: "not_a_number",
  /** The number does not unzip, or unzips far too big: `idcheck.not_aadhaar`. */
  not_gzip: "not_gzip",
  /** Too few bytes to hold a signature: `idcheck.not_aadhaar`. */
  too_short: "too_short",
  /** Signed correctly but not laid out as an Aadhaar card: `idcheck.not_aadhaar`. */
  not_aadhaar: "not_aadhaar",
  /** UIDAI's signature does not match: changed, damaged or made up: `idcheck.bad_signature`. */
  signature_mismatch: "signature_mismatch",
  /** This build has no UIDAI key to check against: `idcheck.unavailable`. */
  no_uidai_key: "no_uidai_key",
  /** An e-KYC file: not a ZIP holding one OfflinePaperlessKyc XML: `idcheck.ekyc_not_file`. */
  not_ekyc_file: "not_ekyc_file",
  /** An e-KYC file the share code does not open: `idcheck.ekyc_wrong_code`. */
  wrong_share_code: "wrong_share_code",
} as const;
export type IdCheckProblem = (typeof IdCheckProblem)[keyof typeof IdCheckProblem];

/** What the phone keeps after a check: the card's few fields and when it was checked (ISO 8601). */
export interface CheckedId extends CardFields {
  readonly checkedAt: string;
}

/**
 * A genuine Aadhaar, and whether it is bound to the person: `binding` compares the number the check was given (the
 * signed-in one) with the Aadhaar's mobile, and `mobile` can compare any other number the holder types, in memory
 * only. Neither serializes the hash, the share code or the last 4 digits of the mobile.
 */
export interface Genuine {
  readonly ok: true;
  readonly id: CheckedId;
  readonly binding: MobileBinding;
  readonly mobile: MobileEvidence;
}

export type IdCheck = Genuine | { readonly ok: false; readonly problem: IdCheckProblem };

export interface IdCheckOptions {
  /** The key to verify against; UIDAI's by default. Tests pass their own. */
  readonly key?: CryptoKey;
  /** Keys as base64 SPKI to try after UIDAI's, for a development build's test cards; none in a release build. */
  readonly extraSpki?: readonly string[];
  /** The number (E.164) the Aadhaar's mobile should match: the one the person signed in with. */
  readonly phone?: string;
  /** The time of the check; now by default. */
  readonly now?: Date;
}

/** A genuine Aadhaar's result, its binding worked out against `phone`. */
export async function genuine(id: CheckedId, mobile: MobileEvidence, phone: string | undefined): Promise<Genuine> {
  return { ok: true, id, binding: await mobile.matches(phone), mobile };
}

const refused = (problem: IdCheckProblem): IdCheck => ({ ok: false, problem });

/**
 * Checks the text of an Aadhaar Secure QR on this phone: unzips it, verifies UIDAI's signature over it, and returns
 * only the name, year of birth, gender and last 4 digits, with the mobile binding. The full number, address, photo and
 * email hash are never decoded, returned or logged, and the unzipped bytes are wiped before it returns.
 */
export async function checkAadhaarQr(qrText: string, options: IdCheckOptions = {}): Promise<IdCheck> {
  const keys = options.key
    ? [options.key]
    : [
        ...(await uidaiKeys()),
        ...(await Promise.all((options.extraSpki ?? []).map((k) => importSpki(k, SECURE_QR_SIGNATURE.hash)))),
      ];
  if (keys.length === 0) return refused(IdCheckProblem.no_uidai_key);
  const zipped = decimalBytes(qrText);
  if (!zipped) return refused(IdCheckProblem.not_a_number);
  const data = await gunzip(zipped);
  zipped.fill(0);
  if (!data) return refused(IdCheckProblem.not_gzip);
  try {
    if (data.length <= SIGNATURE_BYTES) return refused(IdCheckProblem.too_short);
    const signedLength = data.length - SIGNATURE_BYTES;
    const signed = data.subarray(0, signedLength);
    const signature = data.subarray(signedLength);
    if (!(await signedByAny(keys, signature, signed))) return refused(IdCheckProblem.signature_mismatch);
    const now = options.now ?? new Date();
    const read = readCard(signed, now.getFullYear());
    if (!read) return refused(IdCheckProblem.not_aadhaar);
    return genuine({ ...read.card, checkedAt: now.toISOString() }, read.mobile, options.phone);
  } finally {
    data.fill(0);
  }
}

/**
 * Whether one of UIDAI's keys signed the data. A card carries the signature of the key UIDAI used the day it was
 * printed, so a 2021 card checks against the 2021 key and a new one against the newest.
 */
async function signedByAny(
  keys: readonly CryptoKey[],
  signature: Uint8Array<ArrayBuffer>,
  signed: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  for (const key of keys) if (await crypto.subtle.verify(SECURE_QR_SIGNATURE, key, signature, signed)) return true;
  return false;
}
