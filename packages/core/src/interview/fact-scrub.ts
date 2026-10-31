import { type EstimateFact, JobType, MAX_FACT_LABEL, MAX_FACT_VALUE, MAX_FACTS, MAX_JOB_TYPE } from "@gigsync/protocol";
import { REMOVED_MARK, withoutPhones } from "../contacts/phones.js";
import { asciiDigits } from "../job/details.js";

/**
 * Scrubbing what a phone's model wrote before it leaves the phone (ADR 0041, extras): extra facts and a job type are
 * model output from the owner's words, so phone numbers are cut out and anything that looks like an address (a PIN
 * code, a house number with a street word) drops the whole fact. Bounded to the protocol's lengths and count.
 */

/** Six digits, one space allowed in the middle: an Indian PIN code. */
const PIN = /(?<!\d)\d{3} ?\d{3}(?!\d)/u;
/** A house, flat or door number said as such. */
const HOUSE_NUMBER =
  /(?:house|flat|door|plot|h)\s?(?:no|number|#)\s?\d|#\s?\d+|मकान (?:नं|नंबर)|फ्लैट (?:नं|नंबर)|ಮನೆ (?:ನಂ|ನಂಬರ್)/iu;
/** A number followed, within a few words, by a street word: "12 3rd cross", "45, MG Road", "5 वीं गली". */
const NUMBER_THEN_STREET =
  /\d+\s?(?:st|nd|rd|th)?\s?,?\s?(?:[\p{L}\p{M}]+\s){0,3}(?:road|rd|street|cross|main|lane|layout|nagar|block|sector|marg|गली|मार्ग|रोड|ನಗರ|ರಸ್ತೆ|ಕ್ರಾಸ್|ಮುಖ್ಯ ರಸ್ತೆ)(?![\p{L}\p{M}])/iu;
const SPACES = /\s+/g;

/** Whether a text looks like part of an address. */
export const looksLikeAddress = (text: string): boolean => {
  const said = asciiDigits(text);
  return PIN.test(said) || HOUSE_NUMBER.test(said) || NUMBER_THEN_STREET.test(said);
};

/** The text with phone numbers cut out and spaces tidied; undefined when it is an address or nothing is left. */
export function scrubText(text: string, max: number): string | undefined {
  if (looksLikeAddress(text)) return undefined;
  const cut = withoutPhones(text).split(REMOVED_MARK).join(" ").replace(SPACES, " ").trim();
  return cut.length > 0 && cut.length <= max ? cut : undefined;
}

/** Facts fit to send: each label and value scrubbed, a fact dropped whole when either fails, at most `MAX_FACTS`. */
export function scrubFacts(facts: readonly EstimateFact[]): EstimateFact[] {
  const kept: EstimateFact[] = [];
  for (const f of facts) {
    const label = scrubText(f.label, MAX_FACT_LABEL);
    const value = scrubText(f.value, MAX_FACT_VALUE);
    if (label && value && !kept.some((k) => k.label.toLowerCase() === label.toLowerCase())) kept.push({ label, value });
  }
  return kept.slice(0, MAX_FACTS);
}

/** A job type fit to send, or undefined. */
export function scrubJobType(text: string): string | undefined {
  const cut = scrubText(text, MAX_JOB_TYPE);
  return cut === undefined ? undefined : JobType.safeParse(cut).data;
}
