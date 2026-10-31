import type { money as en } from "../en/money.js";

/** Kannada: the passbook of jobs signed on GigSync, and the worker's money actions inside a job. */
export const money: Readonly<Record<keyof typeof en, string>> = {
  "passbook.week": "ಈ ವಾರ ಬಂದದ್ದು",
  "passbook.month": "ಈ ತಿಂಗಳು ಬಂದದ್ದು",
  "passbook.not_asked": "ಇನ್ನೂ ಕೇಳಿಲ್ಲ",
  "passbook.empty": "GigSync ನಲ್ಲಿ ನೀವು ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಮತ್ತು ಅವುಗಳ ಹಣ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "passbook.about": "ಪ್ರತಿ ಸಾಲೂ ನೀವು ಮತ್ತು ಗ್ರಾಹಕರು ಇಬ್ಬರೂ ಸಹಿ ಮಾಡಿದ ಕೆಲಸ. ಇದೆಲ್ಲ ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
  "money.ask_again": "ಮತ್ತೆ ಹಣ ಕೇಳಿ",
  "money.ask_month": "ಈ ತಿಂಗಳ ಹಣ ಕೇಳಿ",
  "money.show_qr": "ನನ್ನ ಕ್ಯೂಆರ್ ತೋರಿಸಿ",
  "money.hide_qr": "ಕ್ಯೂಆರ್ ಮುಚ್ಚಿ",
  "money.cash_confirm": "{price} ನಗದು ಬಂತು ಎಂದು ದಾಖಲಿಸಲೇ?",
  "money.need_upi": "ಗ್ರಾಹಕರು ಹಣ ಕಳುಹಿಸುವ ಯುಪಿಐ ಐಡಿಯನ್ನು “ನನ್ನ ಬಗ್ಗೆ”ಯಲ್ಲಿ ಸೇರಿಸಿ.",
  "money.add_upi": "ಯುಪಿಐ ಐಡಿ ಸೇರಿಸಿ",
  "money.nudge": "ಕೆಲಸ ಮುಗಿಯುವ ಮೊದಲೇ ನಿಮ್ಮ ಯುಪಿಐ ಐಡಿ ಸೇರಿಸಿ, ಆಗ ಗ್ರಾಹಕರು ತಕ್ಷಣ ಹಣ ಕೊಡಬಹುದು.",
  "money.waiting": "{name} ಅವರು {price} ಕಳುಹಿಸುವುದಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದ್ದೇವೆ.",
  "money.asked_at": "{time}ಕ್ಕೆ ಕೇಳಿದ್ದು",
  "money.already_in_bank": "ಹಣ ಈಗಾಗಲೇ ನನ್ನ ಬ್ಯಾಂಕಿಗೆ ಬಂದಿದೆ",
  "money.bank_confirm": "{price} ಬಂದಿದೆ ಎಂದು ದಾಖಲಿಸಲೇ?",
};
