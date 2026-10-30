import type { record as en } from "../en/record.js";

/** Kannada: the worker's record, in Passbook and on their card. */
export const record: Readonly<Record<keyof typeof en, string>> = {
  "record.title": "ಮಾಡಿದ ಕೆಲಸಗಳು",
  "record.jobs.one": "{count} ಕೆಲಸ ಮಾಡಿದ್ದೀರಿ",
  "record.jobs.other": "{count} ಕೆಲಸಗಳನ್ನು ಮಾಡಿದ್ದೀರಿ",
  "record.households.one": "{count} ಮನೆ",
  "record.households.other": "{count} ಮನೆಗಳು",
  "record.since": "{month}ನಿಂದ",
  "record.state_received": "{price} ಬಂದಿದೆ",
  "record.state_cash": "{price} ನಗದು ಬಂದಿದೆ",
  "record.state_waiting": "ಹಣಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "record.state_not_asked": "ಇನ್ನೂ ಕೇಳಿಲ್ಲ",
  "record.state_cancelled": "ರದ್ದಾಗಿದೆ",
  "record.open": "ಈ ಕೆಲಸ ನೋಡಿ",
  "record.close": "ಈ ಕೆಲಸ ಮರೆಮಾಡಿ",
  "record.empty": "GigSync ನಲ್ಲಿ ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",
  // On the worker's card, for households to see (ADR 0036)
  "record.card_label": "ಕೆಲಸದ ದಾಖಲೆ",
  "record.card_jobs": "ಕೆಲಸಗಳು",
  "record.card_rated.one": "{count} ರೇಟಿಂಗ್",
  "record.card_rated.other": "{count} ರೇಟಿಂಗ್‌ಗಳು",
  "record.card_not_rated": "ಇನ್ನೂ ರೇಟಿಂಗ್ ಇಲ್ಲ",
  "record.card_stars": "★ {stars}",
  "record.card_no_stars": "–",
  "record.card_came_back": "ಮತ್ತೆ ಕರೆದವರು",
  "record.card_hidden": "ಈ ಸಂಖ್ಯೆಗಳು ಮನೆಯವರಿಗೆ ಕಾಣುವುದಿಲ್ಲ. ಗೌಪ್ಯತೆಯಲ್ಲಿ ಅವುಗಳನ್ನು ತೋರಿಸಬಹುದು.",
  "record.setting": "ನನ್ನ ಕಾರ್ಡ್‌ನಲ್ಲಿ ನನ್ನ ದಾಖಲೆ ತೋರಿಸಿ",
  "record.setting_about":
    "ಮಾಡಿದ ಕೆಲಸಗಳು, ಮನೆಯವರ ರೇಟಿಂಗ್ ಮತ್ತು ಎಷ್ಟು ಮನೆಯವರು ಮತ್ತೆ ಕರೆದರು, ಮನೆಯವರು ನಿಮ್ಮ ಕಾರ್ಡ್‌ನಲ್ಲಿ ನೋಡಲು. ಎಲ್ಲವೂ ಅಥವಾ ಏನೂ ಇಲ್ಲ: ಒಂದು ರೇಟಿಂಗ್ ಅನ್ನು ಮರೆಮಾಡಲು ಆಗುವುದಿಲ್ಲ.",
};
