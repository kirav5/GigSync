/**
 * Reading the few fields we keep from the signed part of an Aadhaar Secure QR, and nothing else.
 *
 * Layout per UIDAI's Secure QR reader manual (User_manulal_QR_Code_15032019.pdf) as implemented by the open-source
 * readers (pyaadhaar): text fields separated by byte 255, then the photo, then (legacy only) the email and mobile
 * hashes, then the 256-byte signature. Legacy text fields: email/mobile indicator, reference id, name, date of
 * birth, gender, care of, district, landmark, house, location, pin code, post office, state, street, sub-district,
 * village/town/city. The versioned layout ("V2" and later) puts the version first and adds the last 4 digits of the
 * mobile number after the address. The reference id starts with the last 4 digits of the Aadhaar number.
 *
 * Only the reference id's first 4 digits, the name, the year of birth and the gender are ever decoded, plus the
 * mobile's hash or last 4 digits, which go into a MobileEvidence held in memory for the binding check and never kept:
 * the address, the photo and the email hash stay bytes and are wiped with the rest by the caller.
 */

import { MobileEvidence } from "./mobile-binding.js";

/** Byte 255 ends every text field. */
export const FIELD_END = 255;

/** How a person's gender is written on the card. */
export const CardGender = { male: "M", female: "F", transgender: "T" } as const;
export type CardGender = (typeof CardGender)[keyof typeof CardGender];

/** What GigSync keeps from a checked card: never the full number, the address, the photo or the hashes. */
export interface CardFields {
  readonly name: string;
  readonly birthYear: number;
  readonly gender: CardGender;
  /** The last 4 digits of the Aadhaar number, from the start of the reference id. */
  readonly aadhaarLast4: string;
}

/** Text fields in the legacy layout: indicator, reference id, name, date of birth, gender and 11 address fields. */
const LEGACY_TEXT_FIELDS = 16;
/** Text fields in the versioned layout: the version, the 16 legacy fields, the last 4 digits of the mobile number. */
const VERSIONED_TEXT_FIELDS = 18;
/** Where each field sits in the legacy layout; the versioned layout shifts them all by its one version field. */
const LegacyAt = { emailMobile: 0, referenceId: 1, name: 2, dateOfBirth: 3, gender: 4 } as const;
/** The versioned layout's last text field, after the 16 legacy ones: the mobile's last 4 digits, empty when none. */
const MOBILE_LAST_4_AT = LEGACY_TEXT_FIELDS;
/** Bytes in the older layout's SHA-256 mobile hash, the last thing before the signature. */
const MOBILE_HASH_BYTES = 32;
/** The indicator's values that say a mobile is linked: 2 mobile only, 3 email and mobile. */
const MOBILE_LINKED: ReadonlySet<string> = new Set(["2", "3"]);
/** A Secure QR's mobile hash is over the number alone; only the e-KYC file adds its share code. */
const NO_SUFFIX = "";

const VERSION = /^V\d+$/;
/** 0 neither, 1 email, 2 mobile, 3 both. */
const EMAIL_MOBILE = /^[0-3]$/;
const LAST_4 = /^(\d{4})/;
/** A year on its own or at either end of a date: "1990", "15-08-1990", "15/08/1990", "1990-08-15". */
const YEAR = /(?:^|\D)(\d{4})(?:\D|$)/;
const MIN_BIRTH_YEAR = 1900;
const MAX_NAME_LENGTH = 200;
const LAST_4_LENGTH = 4;

const GENDERS: ReadonlySet<string> = new Set(Object.values(CardGender));
const isGender = (text: string): text is CardGender => GENDERS.has(text);
const utf8 = new TextDecoder();

/** The first `count` text fields as byte ranges, or undefined when the data holds fewer. */
function textFields(signed: Uint8Array, count: number): Uint8Array[] | undefined {
  const fields: Uint8Array[] = [];
  let start = 0;
  for (let at = 0; at < signed.length && fields.length < count; at++) {
    if (signed[at] !== FIELD_END) continue;
    fields.push(signed.subarray(start, at));
    start = at + 1;
  }
  return fields.length === count ? fields : undefined;
}

/** What a Secure QR gives: the kept fields, and its mobile evidence (in memory only, identity/mobile-binding.ts). */
export interface CardRead {
  readonly card: CardFields;
  readonly mobile: MobileEvidence;
}

/** The kept fields from the signed bytes, or undefined when they are not laid out as an Aadhaar Secure QR. */
export function readCard(signed: Uint8Array, thisYear: number): CardRead | undefined {
  const first = textFields(signed, 1)?.[0];
  if (!first) return undefined;
  const versioned = VERSION.test(utf8.decode(first));
  const fields = textFields(signed, versioned ? VERSIONED_TEXT_FIELDS : LEGACY_TEXT_FIELDS);
  if (!fields) return undefined;
  const text = (at: number) => {
    const bytes = fields[at + (versioned ? 1 : 0)];
    return bytes ? utf8.decode(bytes).trim() : "";
  };
  const indicator = text(LegacyAt.emailMobile);
  if (!EMAIL_MOBILE.test(indicator)) return undefined;
  const card = keptFields(
    {
      referenceId: text(LegacyAt.referenceId),
      name: text(LegacyAt.name),
      dateOfBirth: text(LegacyAt.dateOfBirth),
      gender: text(LegacyAt.gender),
    },
    thisYear,
  );
  if (!card) return undefined;
  if (versioned) return { card, mobile: MobileEvidence.lastFour(text(MOBILE_LAST_4_AT)) };
  // The older layout ends with the email hash then the mobile hash: the mobile's is the last before the signature.
  const hash = MOBILE_LINKED.has(indicator) ? signed.subarray(signed.length - MOBILE_HASH_BYTES) : undefined;
  return { card, mobile: MobileEvidence.hashed(hash, NO_SUFFIX, card.aadhaarLast4) };
}

/** The four texts both Aadhaar formats carry and GigSync reads: the reference id, name, date of birth and gender. */
export interface AadhaarTexts {
  readonly referenceId: string;
  readonly name: string;
  readonly dateOfBirth: string;
  readonly gender: string;
}

/**
 * The kept fields from an Aadhaar's texts (a Secure QR's or an Offline e-KYC file's), or undefined when one is not
 * what an Aadhaar holds: a name too long or empty, no year of birth from 1900 to this year, an unknown gender.
 */
export function keptFields(texts: AadhaarTexts, thisYear: number): CardFields | undefined {
  const last4 = LAST_4.exec(texts.referenceId.trim())?.[1];
  const name = texts.name.trim();
  const year = Number(YEAR.exec(texts.dateOfBirth.trim())?.[1]);
  const gender = texts.gender.trim().toUpperCase();
  if (!last4 || last4.length !== LAST_4_LENGTH || !name || name.length > MAX_NAME_LENGTH) return undefined;
  if (!(year >= MIN_BIRTH_YEAR && year <= thisYear) || !isGender(gender)) return undefined;
  return { name, birthYear: year, gender, aadhaarLast4: last4 };
}
