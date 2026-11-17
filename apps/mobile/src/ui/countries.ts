/**
 * The countries a mobile number may come from at sign-in: India first (the pilot), then the neighbours and the Gulf
 * countries many families and workers have numbers from, then a few more. Each lists how many digits its mobile
 * numbers have after the country code and the digits they may start with, so a wrong number is caught on the phone,
 * before an SMS is spent on it. Names come from the phone's own list (Intl.DisplayNames), in the owner's language.
 */
export interface Country {
  /** ISO 3166 code: the flag and the name. */
  readonly iso: string;
  /** The country code, without the "+". */
  readonly dial: string;
  /** How many digits a mobile number has after the country code: fewest, most. */
  readonly digits: readonly [number, number];
  /** The digits a mobile number may start with; any when absent. */
  readonly starts?: string;
}

/** The digit 1: the country code the United States and Canada share, and how Bangladesh and Malaysia mobiles start. */
const ONE = "1";

export const INDIA: Country = { iso: "IN", dial: "91", digits: [10, 10], starts: "6789" };

export const COUNTRIES: readonly Country[] = [
  INDIA,
  { iso: "NP", dial: "977", digits: [10, 10], starts: "9" },
  { iso: "BD", dial: "880", digits: [10, 10], starts: ONE },
  { iso: "LK", dial: "94", digits: [9, 9], starts: "7" },
  { iso: "BT", dial: "975", digits: [8, 8], starts: "17" },
  { iso: "AE", dial: "971", digits: [9, 9], starts: "5" },
  { iso: "SA", dial: "966", digits: [9, 9], starts: "5" },
  { iso: "QA", dial: "974", digits: [8, 8], starts: "3567" },
  { iso: "OM", dial: "968", digits: [8, 8], starts: "79" },
  { iso: "KW", dial: "965", digits: [8, 8], starts: "569" },
  { iso: "SG", dial: "65", digits: [8, 8], starts: "89" },
  { iso: "MY", dial: "60", digits: [9, 10], starts: ONE },
  { iso: "GB", dial: "44", digits: [10, 10], starts: "7" },
  { iso: "US", dial: ONE, digits: [10, 10] },
  { iso: "CA", dial: ONE, digits: [10, 10] },
  { iso: "AU", dial: "61", digits: [9, 9], starts: "4" },
];

/** Regional indicator symbols start here; "IN" becomes 🇮🇳. Phones draw the flag; Windows shows the two letters. */
const REGIONAL_A = 0x1f1e6;
const LETTER_A = "A".charCodeAt(0);

export const flag = (iso: string): string =>
  String.fromCodePoint(...[...iso].map((letter) => REGIONAL_A + letter.charCodeAt(0) - LETTER_A));

/** The country's name in the owner's language, or its code where the phone has no name for it. */
export function countryName(iso: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

export const countryByIso = (iso: string | undefined): Country => COUNTRIES.find((c) => c.iso === iso) ?? INDIA;
