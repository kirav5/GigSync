import { normalize, SPACE } from "./normalize.js";

/**
 * A message that only says hello: answered as a person would, never with "Sorry, I didn't catch that", and never read
 * as a job (a model, asked what work "hey" is, answers "general inquiry").
 */

const GREETINGS: ReadonlySet<string> = new Set(
  [
    "hi",
    "hii",
    "hello",
    "helo",
    "hey",
    "heya",
    "yo",
    "namaste",
    "namaskar",
    "namaskara",
    "namaskaram",
    "good morning",
    "good afternoon",
    "good evening",
    "नमस्ते",
    "नमस्कार",
    "हेलो",
    "ನಮಸ್ಕಾರ",
    "ನಮಸ್ತೆ",
    "ಹಲೋ",
  ].map(normalize),
);
/** Words of courtesy a greeting may carry ("hi there"). */
const ALONG: ReadonlySet<string> = new Set(["there", "ji", "sir", "madam", "anna", "akka", "bhaiya"]);
const MAX_WORDS = 3;

/** The whole message is a greeting; a need that starts with one ("hi, my tap leaks") is not. */
export function isGreeting(text: string): boolean {
  const said = normalize(text);
  if (GREETINGS.has(said)) return true;
  const words = said.split(SPACE);
  const rest = words.filter((w) => !ALONG.has(w));
  return words.length <= MAX_WORDS && rest.length > 0 && GREETINGS.has(rest.join(SPACE));
}
