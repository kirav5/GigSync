import type { ask as en } from "../en/ask.js";

/** Hindi: questions the worker's agent asked and where each answer came from. */
export const ask: Readonly<Record<keyof typeof en, string>> = {
  "ask.by_theirs": "{name} के सहायक का सवाल",
  "ask.by_mine": "आपके सहायक का सवाल",
  "ask.standard": "सामान्य सवाल",
  "ask.from_memory": "आपके पिछले कामों से",
  "ask.from_words": "आपकी कही बात से",
  "ask.skip": "छोड़ें",
  "ask.skipped": "छोड़ दिया",
  "ask.number": "एक संख्या",
  "ask.memory_offer": "आपके पिछले कामों से: {value}। यही भेजें?",
  "ask.memory_old": "एक साल पहले यह पता था: {value}। क्या अब भी सही है?",
  "ask.change": "बदलें",
};
