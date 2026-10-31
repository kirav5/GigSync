import { asciiDigits } from "@gigsync/core";
import { Phone } from "@gigsync/protocol";

/** India's country code: the pilot's numbers are Indian mobiles typed the way people say them. */
const INDIA = "91";
/** An Indian mobile number without its country code. */
const MOBILE_DIGITS = 10;
/** The trunk prefix some people type before a mobile number ("0 98765 43210"). */
const TRUNK = "0";

/**
 * A number as typed ("98765 43210", "098765-43210", "+91 98765 43210", in any script's digits) in the international
 * form the server takes ("+919876543210"), or undefined when it cannot be one.
 */
export function phoneE164(typed: string): string | undefined {
  const text = asciiDigits(typed).trim();
  const digits = text.replace(/\D/g, "");
  let e164 = `+${digits}`;
  if (!text.startsWith("+")) {
    if (digits.length === MOBILE_DIGITS) e164 = `+${INDIA}${digits}`;
    else if (digits.length === MOBILE_DIGITS + 1 && digits.startsWith(TRUNK)) e164 = `+${INDIA}${digits.slice(1)}`;
  }
  return Phone.safeParse(e164).success ? e164 : undefined;
}
