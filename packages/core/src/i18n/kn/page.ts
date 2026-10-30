import type { page as en } from "../en/page.js";

/** Kannada: the pages the menu opens, each on its own: My card, a household's Receipts, About me, Privacy and Settings. */
export const page: Readonly<Record<keyof typeof en, string>> = {
  // My card
  "page.card_soft_worker": "ಮನೆಯವರು ಏನು ನೋಡುತ್ತಾರೆ, ಮತ್ತು ನಿಮ್ಮ QR.",
  "page.card_seen": "ಮನೆಯವರು ಇದನ್ನು ನೋಡುತ್ತಾರೆ",
  "page.card_none": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಇನ್ನೂ ಇಲ್ಲ. ಮಾತಾಡಿ ಮಾಡಿ, ಅಥವಾ ಫಾರ್ಮ್ ತುಂಬಿ.",
  "page.card_make": "ಮಾತಾಡಿ ಮಾಡಿ",
  "page.see_card": "ಮನೆಯವರು ನೋಡುವಂತೆ ನಿಮ್ಮ ಕಾರ್ಡ್ ನೋಡಿ",
  "page.card_soft": "ತೋರಿಸಿ, ಹಂಚಿ, ಬೇರೆಯವರದನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.",
  // A household's Receipts
  "page.receipts_soft": "GigSync ನಲ್ಲಿ ನೀವು ಹಣ ಕೊಟ್ಟ ಕೆಲಸಗಳು.",
  "page.receipts_total": "ಒಟ್ಟು ಕೊಟ್ಟದ್ದು",
  "page.receipts_empty": "ಇನ್ನೂ ಏನೂ ಕೊಟ್ಟಿಲ್ಲ. ನೀವು ಹಣ ಕೊಡುವ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",
  "page.paid": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ",
  "page.paid_unconfirmed": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ · ಇನ್ನೂ ಖಚಿತವಾಗಿಲ್ಲ",
  // About me
  "page.about_title": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ಏನು ಗೊತ್ತು.",
  // Privacy
  "page.privacy_title": "ಯಾರು ಏನು ನೋಡುತ್ತಾರೆ.",
  "page.privacy_soft": "ನಿಮ್ಮ ಏಜೆಂಟ್ ಏನು ಹಂಚುತ್ತದೆ, ಮತ್ತು ನೀವು ಯಾರನ್ನು ದೂರ ಇಟ್ಟಿದ್ದೀರಿ.",
  "page.blocked": "ನೀವು ಬ್ಲಾಕ್ ಮಾಡಿದವರು",
  "page.blocked_about": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಎಲ್ಲೆಡೆ ಮರೆಯಾಗಿರುತ್ತಾರೆ, ಮತ್ತೆ ಎಂದೂ ನಿಮ್ಮ ಜೊತೆ ಹೊಂದಿಸಲಾಗುವುದಿಲ್ಲ. ಬ್ಲಾಕ್ ಅನ್ನು ಇಲ್ಲಿಂದ ತೆಗೆಯಲು ಆಗುವುದಿಲ್ಲ.",
  "page.blocked_none": "ನೀವು ಯಾರನ್ನೂ ಬ್ಲಾಕ್ ಮಾಡಿಲ್ಲ.",
  "page.blocked_unnamed": "ನೀವು ಎಂದೂ ಕೆಲಸ ಮಾಡದವರು",
  "page.blocked_on": "{date} ರಂದು ಬ್ಲಾಕ್ ಮಾಡಲಾಗಿದೆ",
  // Settings
  "page.settings_title": "ನೀವು ಮತ್ತು ನಿಮ್ಮ ಏಜೆಂಟ್.",
  "page.settings_soft": "ಅದು ಹೇಗೆ ಚೌಕಾಸಿ ಮಾಡುತ್ತದೆ, ಮಾತಾಡುತ್ತದೆ, ಕಾಣುತ್ತದೆ ಮತ್ತು ನಡೆಯುತ್ತದೆ. ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
};
