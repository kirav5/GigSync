import { Arrangement } from "@gigsync/protocol";

/**
 * The words for each arrangement (ADR 0046) in English, Hindi and Kannada, read on every phone, model or not. Checked
 * longest stretch of time first, so "once a week" is weekly. A cook's one meal or party is one visit (ADR 0051).
 */

const A = Arrangement.enum;

const SAID: readonly (readonly [Arrangement, RegExp])[] = [
  [A.monthly, /\b(?:month|monthly)\b|महीन|ಮಾಸಿಕ|ತಿಂಗಳ/i],
  [A.weekly, /\b(?:weekly|a week|per week|days? a week)\b|हफ़्त|हफ्त|ವಾರದಲ್ಲಿ|ವಾರಕ್ಕೆ/i],
  [
    A.visit,
    /\b(?:once|one[- ]?(?:time|off|visit|meal)|a (?:party|function|occasion))\b|एक बार|एक वक़्त|पार्टी|ಒಂದೇ ಸಲ|ಒಮ್ಮೆ|ಒಂದು ಸಲ|ಪಾರ್ಟಿ/i,
  ],
  [A.hourly, /\b(?:hours?|hourly)\b|घंट|ಗಂಟೆ/i],
];

/** The arrangement a sentence names, if any. */
export const arrangementSaid = (text: string): Arrangement | undefined =>
  SAID.find(([, words]) => words.test(text))?.[0];

/** Each arrangement a sentence names, split at "and" or commas ("hourly and monthly"), in the order listed. */
export function arrangementsSaid(text: string): Arrangement[] {
  const named = text.split(/,|\band\b|और|ಮತ್ತು/u).map(arrangementSaid);
  return Arrangement.options.filter((a) => named.includes(a));
}
