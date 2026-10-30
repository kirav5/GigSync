import { canonicalJson, type JobTerms } from "@gigsync/protocol";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export * from "./base64.js";
export * from "./box.js";
export * from "./keys.js";
export * from "./seal.js";

/** SHA-256 of the canonical JSON of the terms, hex: what both sides sign, and how they know they signed the same. */
export function termsHash(terms: JobTerms): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(terms))));
}
