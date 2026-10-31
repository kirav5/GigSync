import type { explain as en } from "../en/explain.js";

/** Kannada: why an offer is what it is, one sentence per fact. */
export const explain: Readonly<Record<keyof typeof en, string>> = {
  "explain.opened_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ {price} ರಿಂದ ಶುರು ಮಾಡಿತು.",
  "explain.opened_theirs": "{name} {price} ರಿಂದ ಶುರು ಮಾಡಿದರು.",
  "explain.down_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ {delta} ಇಳಿಸಿ {price} ಗೆ ಬಂತು.",
  "explain.down_theirs": "{name} {delta} ಇಳಿಸಿ {price} ಗೆ ಬಂದರು.",
  "explain.up_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ {delta} ಏರಿಸಿ {price} ಗೆ ಬಂತು.",
  "explain.up_theirs": "{name} {delta} ಏರಿಸಿ {price} ಗೆ ಬಂದರು.",
  "explain.held_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ ಬೆಲೆ {price} ಉಳಿಸಿ ಷರತ್ತು ಬದಲಿಸಿತು.",
  "explain.held_theirs": "{name} ಬೆಲೆ {price} ಉಳಿಸಿ ಷರತ್ತು ಬದಲಿಸಿದರು.",
  "explain.terms_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ ಹೇಳಿದ್ದು: {terms}.",
  "explain.terms_theirs": "{name} ಹೇಳಿದ್ದು: {terms}.",
  "explain.usual.one": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, {count} ಮೂಲದಿಂದ).",
  "explain.usual.other": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, {count} ಮೂಲಗಳಿಂದ).",
  "explain.usual_jobs.one": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, GigSync ನ {count} ಕೆಲಸದಿಂದ).",
  "explain.usual_jobs.other": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, GigSync ನ {count} ಕೆಲಸಗಳಿಂದ).",
  "explain.usual_range": "ಸಾಮಾನ್ಯ ದರ {low}–{high}.",
  "explain.limit_within": "ಇದು ನಿಮ್ಮ ಮಿತಿ {limit} ಒಳಗಿದೆ.",
  "explain.limit_outside": "ಇದು ನಿಮ್ಮ ಮಿತಿ {limit} ಗಿಂತ {gap} ಹೊರಗಿದೆ.",
  "explain.label": "ಈ ಆಫರ್ ಏಕೆ",
};
