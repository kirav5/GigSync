import type { ask as en } from "../en/ask.js";

/** Kannada: questions the worker's agent asked and where each answer came from. */
export const ask: Readonly<Record<keyof typeof en, string>> = {
  "ask.by_theirs": "{name} ಅವರ ಸಹಾಯಕ ಕೇಳಿದ ಪ್ರಶ್ನೆ",
  "ask.by_mine": "ನಿಮ್ಮ ಸಹಾಯಕ ಕೇಳಿದ ಪ್ರಶ್ನೆ",
  "ask.standard": "ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆ",
  "ask.from_memory": "ನಿಮ್ಮ ಹಿಂದಿನ ಕೆಲಸಗಳಿಂದ",
  "ask.from_words": "ನೀವು ಹೇಳಿದ್ದರಿಂದ",
  "ask.skip": "ಬಿಡಿ",
  "ask.skipped": "ಬಿಟ್ಟಿದ್ದಾರೆ",
  "ask.number": "ಒಂದು ಸಂಖ್ಯೆ",
  "ask.memory_offer": "ನಿಮ್ಮ ಹಿಂದಿನ ಕೆಲಸಗಳಿಂದ: {value}. ಇದನ್ನೇ ಕಳುಹಿಸಲೇ?",
  "ask.memory_old": "ಒಂದು ವರ್ಷದ ಹಿಂದೆ ಇದು ತಿಳಿದಿತ್ತು: {value}. ಈಗಲೂ ಸರಿಯೇ?",
  "ask.change": "ಬದಲಿಸಿ",
};
