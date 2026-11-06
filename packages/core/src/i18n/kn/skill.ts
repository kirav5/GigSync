import type { skill as en } from "../en/skill.js";

/** ಪಟ್ಟಿಯ ಹೊರಗಿನ ಕೆಲಸ (ADR 0047): ಕೆಲಸಗಾರರು ತಮ್ಮ ಮಾತಿನಲ್ಲೇ ಕೆಲಸ ಬರೆಯುತ್ತಾರೆ, ಮನೆಯವರು ಅದೇ ಕೆಲಸ ಕೇಳುತ್ತಾರೆ. */
export const skill: Readonly<Record<keyof typeof en, string>> = {
  "trade.other": "ಬೇರೆ ಕೆಲಸ",
  "question.job": "ಕೆಲಸ ನಿಖರವಾಗಿ ಏನು?",
  "detail.job": "ಕೆಲಸ",
  "question.duration": "ಸುಮಾರು ಎಷ್ಟು ಸಮಯ ಬೇಕು?",
  "detail.duration": "ಎಷ್ಟು ಸಮಯ ಬೇಕು",
  "skill.err.length": "ಕೆಲಸದ ಹೆಸರನ್ನು 2 ರಿಂದ 40 ಅಕ್ಷರಗಳಲ್ಲಿ ಬರೆಯಿರಿ.",
  "skill.err.words": "ಕೆಲಸದ ಹೆಸರನ್ನು ಕೆಲವೇ ಪದಗಳಲ್ಲಿ ಬರೆಯಿರಿ, ಉದಾ. “ದರ್ಜಿ” ಅಥವಾ “ತೋಟದ ಕೆಲಸ”.",
  "skill.err.characters": "ಕೆಲಸದ ಹೆಸರಿನಲ್ಲಿ ಅಕ್ಷರಗಳು ಮಾತ್ರ: ಸಂಖ್ಯೆ, ಲಿಂಕ್ ಅಥವಾ ಸಂಪರ್ಕ ಬೇಡ.",
  "skill.err.blocked": "ಈ ಕೆಲಸವನ್ನು GigSync ನಲ್ಲಿ ಬರೆಯಲಾಗದು.",
  "skill.err.too_many": "ಒಂದು ಕಾರ್ಡ್‌ನಲ್ಲಿ ಹೆಚ್ಚೆಂದರೆ {max} ರೀತಿಯ ಕೆಲಸ ಇರಬಹುದು.",
  "skill.is_trade": "ಇದು {trade}: ಇದು ಪಟ್ಟಿಯಲ್ಲಿದೆ, ಅದರ ದರಗಳೊಂದಿಗೆ.",
  "card.skill_label": "ಬೇರೆ ಕೆಲಸ, ನಿಮ್ಮ ಮಾತಿನಲ್ಲಿ",
  "card.skill_example": "ದರ್ಜಿ",
  "card.skill_add": "ಸೇರಿಸಿ",
  "card.skill_remove": "{skill} ತೆಗೆಯಿರಿ",
  "iv.skill_kept": "ನಾನು ಇದನ್ನು “{skill}” ಎಂದು ಬರೆಯುತ್ತೇನೆ.",
  "need.skill_found": "ನಿಮ್ಮ ಹತ್ತಿರದ ಕೆಲಸಗಾರರು “{skill}” ಕೆಲಸ ಮಾಡುತ್ತಾರೆ.",
  "need.pick_work": "ಪಟ್ಟಿಯಿಂದ ಆರಿಸಿ",
  "need.skill_no_rate": "GigSync ನಲ್ಲಿ ಈ ಕೆಲಸಕ್ಕೆ ಇನ್ನೂ ಚಾಲ್ತಿ ದರ ಇಲ್ಲ. ನೀವು ಎಷ್ಟು ಕೊಡುತ್ತೀರಿ ಹೇಳಿ.",
  "need.listed_rates":
    "ನಿಮ್ಮ ಹತ್ತಿರದ ಕೆಲಸಗಾರರು ಈ ಕೆಲಸಕ್ಕೆ ಸುಮಾರು {low} ರಿಂದ {high} ಹೇಳುತ್ತಾರೆ ({count} ಕೆಲಸಗಾರರು). ನೀವು ಎಷ್ಟು ಕೊಡುತ್ತೀರಿ ಎಂದು ಹೇಳಿ.",
};
