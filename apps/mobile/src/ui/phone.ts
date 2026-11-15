import { asciiDigits } from "@gigsync/core";
import { Phone } from "@gigsync/protocol";
import { COUNTRIES, type Country, INDIA } from "./countries.js";

/** The trunk prefix some people type before a mobile number ("0 98765 43210"). */
const TRUNK = "0";
const PLUS = "+";
/** India's numbers are shown as people say them, five and five ("98765 43210"). */
const INDIA_GROUP = 5;

/** The digits of what was typed, in any script, without a country code or trunk 0 the owner typed by habit. */
function nationalDigits(typed: string, country: Country): string {
  let digits = asciiDigits(typed).replace(/\D/g, "");
  const [fewest] = country.digits;
  // Only a whole number with its code in front loses the code: one key too many on "91234 56789" is not a "+91".
  if (digits.length >= country.dial.length + fewest && digits.startsWith(country.dial))
    digits = digits.slice(country.dial.length);
  if (digits.length > fewest && digits.startsWith(TRUNK)) digits = digits.slice(TRUNK.length);
  return digits;
}

/**
 * What the number field shows as the owner types: digits only, never more than the country's mobile numbers have (a
 * pasted "+91 98765 43210" or "098765 43210" loses its prefix first). Indian numbers are grouped five and five.
 */
export function typedNumber(typed: string, country: Country): string {
  const digits = nationalDigits(typed, country).slice(0, country.digits[1]);
  if (country !== INDIA || digits.length <= INDIA_GROUP) return digits;
  return `${digits.slice(0, INDIA_GROUP)} ${digits.slice(INDIA_GROUP)}`;
}

/**
 * A number as typed for the chosen country ("98765 43210", "098765-43210", "+91 98765 43210", in any script's
 * digits) in the international form the server takes ("+919876543210"), or undefined when it cannot be a mobile
 * number there: too few or too many digits, or a first digit that country's mobiles never start with.
 */
export function phoneE164(typed: string, country: Country = INDIA): string | undefined {
  const digits = nationalDigits(typed, country);
  const [fewest, most] = country.digits;
  if (digits.length < fewest || digits.length > most) return undefined;
  if (country.starts && !country.starts.includes(digits.charAt(0))) return undefined;
  const e164 = `${PLUS}${country.dial}${digits}`;
  return Phone.safeParse(e164).success ? e164 : undefined;
}

/** "+919876543210" as people read it: "+91 98765 43210". */
export function shownNumber(e164: string, country: Country = INDIA): string {
  const prefix = `${PLUS}${country.dial}`;
  if (!e164.startsWith(prefix)) return e164;
  return `${prefix} ${typedNumber(e164.slice(prefix.length), country)}`;
}

/** The countries, longest dialling code first, so "+1" never claims a number a longer code starting with 1 owns. */
const BY_CODE_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** "+919876543210" back as the number field holds it: the country and "98765 43210", for signing in with it again. */
export function typedFrom(e164: string): { country: Country; typed: string } {
  const country = BY_CODE_LENGTH.find((c) => e164.startsWith(`${PLUS}${c.dial}`)) ?? INDIA;
  return { country, typed: typedNumber(e164.slice(PLUS.length + country.dial.length), country) };
}
