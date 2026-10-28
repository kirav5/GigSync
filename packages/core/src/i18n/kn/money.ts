import type { money as en } from "../en/money.js";

/** Kannada: the passbook of jobs signed on GigSync, and the worker's money actions inside a job. */
export const money: Readonly<Record<keyof typeof en, string>> = {
  "passbook.headline": "ನಿಮ್ಮ ಸಂಪಾದನೆ.",
  "passbook.soft": "GigSync ನಲ್ಲಿ ಒಪ್ಪಿದ ಕೆಲಸಗಳು ಮಾತ್ರ.",
  "passbook.week": "ಈ ವಾರ ಬಂದದ್ದು",
  "passbook.month": "ಈ ತಿಂಗಳು ಬಂದದ್ದು",
  "passbook.not_asked": "ಇನ್ನೂ ಕೇಳಿಲ್ಲ",
  "passbook.empty": "GigSync ನಲ್ಲಿ ಒಪ್ಪಿದ ಕೆಲಸಗಳ ಹಣ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  "passbook.about": "ಪ್ರತಿ ಸಾಲೂ ನೀವು ಮತ್ತು ಗ್ರಾಹಕರು ಇಬ್ಬರೂ ಸಹಿ ಮಾಡಿದ ಕೆಲಸ. ಇದೆಲ್ಲ ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
  "money.ask_again": "ಮತ್ತೆ ಹಣ ಕೇಳಿ",
  "money.ask_month": "ಈ ತಿಂಗಳ ಹಣ ಕೇಳಿ",
  "money.show_qr": "ನನ್ನ ಕ್ಯೂಆರ್ ತೋರಿಸಿ",
  "money.hide_qr": "ಕ್ಯೂಆರ್ ಮುಚ್ಚಿ",
  "money.cash_confirm": "{price} ನಗದು ಬಂತು ಎಂದು ದಾಖಲಿಸಲೇ?",
  "money.need_upi": "ಗ್ರಾಹಕರು ಹಣ ಕಳುಹಿಸುವ ಯುಪಿಐ ಐಡಿಯನ್ನು ಪ್ರೊಫೈಲ್‌ನಲ್ಲಿ ಸೇರಿಸಿ.",
  "money.add_upi": "ಯುಪಿಐ ಐಡಿ ಸೇರಿಸಿ",
  "money.nudge": "ಕೆಲಸ ಮುಗಿಯುವ ಮೊದಲೇ ನಿಮ್ಮ ಯುಪಿಐ ಐಡಿ ಸೇರಿಸಿ, ಆಗ ಗ್ರಾಹಕರು ತಕ್ಷಣ ಹಣ ಕೊಡಬಹುದು.",
};
