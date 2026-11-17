import type { page as en } from "../en/page.js";

/** Kannada: the pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page: Readonly<Record<keyof typeof en, string>> = {
  // My card
  "page.card_seen": "ಮನೆಯವರು ಇದನ್ನು ನೋಡುತ್ತಾರೆ",
  "page.card_none": 'ನಿಮ್ಮ ಕಾರ್ಡ್ ಇನ್ನೂ ಇಲ್ಲ. "ನನ್ನ ಕಾರ್ಡ್ ಬದಲಿಸಿ" ಮೂಲಕ ಮಾಡಿ, ಅಥವಾ ಚಾಟ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಸಹಾಯಕನಿಗೆ ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಹೇಳಿ.',
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "GigSync ನಲ್ಲಿ ನೀವು ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಮತ್ತು ಅವುಗಳ ಗಳಿಕೆ.",
  "page.records_soft": "GigSync ನಲ್ಲಿ ನಿಮಗಾಗಿ ಆದ ಕೆಲಸಗಳು ಮತ್ತು ನೀವು ಕೊಟ್ಟ ಹಣ.",
  "page.records_empty": "ಇನ್ನೂ ಇಲ್ಲಿ ಏನೂ ಇಲ್ಲ. ನಿಮಗಾಗಿ ಮಾಡಿದ ಕೆಲಸ ಮುಗಿದ ಮೇಲೆ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  "page.not_paid": "ಯಾವ ಪಾವತಿಯೂ ದಾಖಲಾಗಿಲ್ಲ",
  "page.not_completed": "ಮುಗಿಯದವು · {count}",
  "page.paid": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ",
  "page.paid_unconfirmed": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ · ಇನ್ನೂ ಖಚಿತವಾಗಿಲ್ಲ",
  // About me
  "page.about_title": "ನಿಮ್ಮ ಸಹಾಯಕನಿಗೆ ಏನು ಗೊತ್ತು.",
  // Privacy
  "page.privacy_title": "ಯಾರು ಏನು ನೋಡುತ್ತಾರೆ.",
  "page.privacy_soft": "ನಿಮ್ಮ ಸಹಾಯಕ ಏನು ಹಂಚುತ್ತದೆ, ಮತ್ತು ನೀವು ಯಾರನ್ನು ದೂರ ಇಟ್ಟಿದ್ದೀರಿ.",
  // Settings
  "page.settings_title": "ನೀವು ಮತ್ತು ನಿಮ್ಮ ಸಹಾಯಕ.",
  "page.settings_soft": "ಅದು ಹೇಗೆ ಚೌಕಾಸಿ ಮಾಡುತ್ತದೆ, ಮಾತಾಡುತ್ತದೆ, ಕಾಣುತ್ತದೆ ಮತ್ತು ನಡೆಯುತ್ತದೆ. ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
};
