import type { explain as en } from "../en/explain.js";

/** Kannada: why an offer is what it is, one sentence per fact. */
export const explain: Readonly<Record<keyof typeof en, string>> = {
  "explain.opened_mine": "ನಿಮ್ಮ ಸಹಾಯಕ {price} ರಿಂದ ಶುರು ಮಾಡಿತು.",
  "explain.opened_theirs": "{name} {price} ರಿಂದ ಶುರು ಮಾಡಿದರು.",
  "explain.down_mine": "ನಿಮ್ಮ ಸಹಾಯಕ {delta} ಇಳಿಸಿ {price} ಗೆ ಬಂತು.",
  "explain.down_theirs": "{name} {delta} ಇಳಿಸಿ {price} ಗೆ ಬಂದರು.",
  "explain.up_mine": "ನಿಮ್ಮ ಸಹಾಯಕ {delta} ಏರಿಸಿ {price} ಗೆ ಬಂತು.",
  "explain.up_theirs": "{name} {delta} ಏರಿಸಿ {price} ಗೆ ಬಂದರು.",
  "explain.held_mine": "ನಿಮ್ಮ ಸಹಾಯಕ ಬೆಲೆಯನ್ನು {price} ಆಗಿಯೇ ಉಳಿಸಿತು.",
  "explain.held_theirs": "{name} ಬೆಲೆಯನ್ನು {price} ಆಗಿಯೇ ಉಳಿಸಿದರು.",
  "explain.terms_mine": "ನಿಮ್ಮ ಸಹಾಯಕ ಹೇಳಿದ್ದು: {terms}.",
  "explain.terms_theirs": "{name} ಹೇಳಿದ್ದು: {terms}.",
  "explain.usual_jobs.one": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, GigSync ನ {count} ಕೆಲಸದಿಂದ).",
  "explain.usual_jobs.other": "ಸಾಮಾನ್ಯ ದರ {typical} ({low}–{high}, GigSync ನ {count} ಕೆಲಸಗಳಿಂದ).",
  "explain.usual_range": "ಸಾಮಾನ್ಯ ದರ {low}–{high}.",
  "explain.limit.provider.above": "ಇದು ನಿಮ್ಮ ಕನಿಷ್ಠ ಬೆಲೆ {limit} ಗಿಂತ {gap} ಹೆಚ್ಚು.",
  "explain.limit.provider.below": "ಇದು ನಿಮ್ಮ ಕನಿಷ್ಠ ಬೆಲೆ {limit} ಗಿಂತ {gap} ಕಡಿಮೆ.",
  "explain.limit.provider.at": "ಇದು ನಿಮ್ಮ ಕನಿಷ್ಠ ಬೆಲೆ {limit} ಗೆ ಸರಿಯಾಗಿ ಸಮ.",
  "explain.limit.requester.above": "ಇದು ನಿಮ್ಮ ಬಜೆಟ್ {limit} ಗಿಂತ {gap} ಹೆಚ್ಚು.",
  "explain.limit.requester.below": "ಇದು ನಿಮ್ಮ ಬಜೆಟ್ {limit} ಗಿಂತ {gap} ಕಡಿಮೆ.",
  "explain.limit.requester.at": "ಇದು ನಿಮ್ಮ ಬಜೆಟ್ {limit} ಗೆ ಸರಿಯಾಗಿ ಸಮ.",
  "explain.label": "ಈ ಆಫರ್ ಏಕೆ",
};
