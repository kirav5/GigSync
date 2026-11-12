import type { page as en } from "../en/page.js";

/** Kannada: the pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page: Readonly<Record<keyof typeof en, string>> = {
  // My card
  "page.card_soft_worker": "ಇದನ್ನು ಹಂಚಿ — ಯಾರಾದರೂ ಕೆಲಸಕ್ಕೆ ನಿಮ್ಮನ್ನು ಕೇಳಬಹುದು.",
  "page.card_seen": "ಮನೆಯವರು ಇದನ್ನು ನೋಡುತ್ತಾರೆ",
  "page.card_none": 'ನಿಮ್ಮ ಕಾರ್ಡ್ ಇನ್ನೂ ಇಲ್ಲ. "ನನ್ನ ಕಾರ್ಡ್ ಬದಲಿಸಿ" ಮೂಲಕ ಮಾಡಿ, ಅಥವಾ ಚಾಟ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಹೇಳಿ.',
  "page.card_soft": "ಇದನ್ನು ಹಂಚಿ — ಕೆಲಸಗಾರರು ನಿಮಗಾಗಿ ಕೆಲಸ ಮಾಡಲು ಮುಂದೆ ಬರಬಹುದು.",
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "GigSync ನಲ್ಲಿ ನೀವು ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಮತ್ತು ಅವುಗಳ ಗಳಿಕೆ.",
  "page.records_soft": "GigSync ನಲ್ಲಿ ನಿಮಗಾಗಿ ಆದ ಕೆಲಸಗಳು ಮತ್ತು ನೀವು ಕೊಟ್ಟ ಹಣ.",
  "page.records_total": "ಒಟ್ಟು ಕೊಟ್ಟದ್ದು",
  "page.records_empty": "ಇನ್ನೂ ಯಾವ ಕೆಲಸವೂ ಮುಗಿದಿಲ್ಲ. ಕೆಲಸ ಮುಗಿದ ಮೇಲೆ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  "page.not_paid": "ಯಾವ ಪಾವತಿಯೂ ದಾಖಲಾಗಿಲ್ಲ",
  "page.not_completed": "ಮುಗಿಯದವು · {count}",
  "page.paid": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ",
  "page.paid_unconfirmed": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ · ಇನ್ನೂ ಖಚಿತವಾಗಿಲ್ಲ",
  // About me
  "page.about_title": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ಏನು ಗೊತ್ತು.",
  // Privacy
  "page.privacy_title": "ಯಾರು ಏನು ನೋಡುತ್ತಾರೆ.",
  "page.privacy_soft": "ನಿಮ್ಮ ಏಜೆಂಟ್ ಏನು ಹಂಚುತ್ತದೆ, ಮತ್ತು ನೀವು ಯಾರನ್ನು ದೂರ ಇಟ್ಟಿದ್ದೀರಿ.",
  "page.privacy_model_title": "ನಿಮ್ಮ ಮಾತುಗಳು ಮತ್ತು GigSync ಮಾಡೆಲ್",
  "page.privacy_model_about":
    "ನೀವು ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ಬರೆಯುವುದನ್ನು GigSync ನ ಸ್ವಂತ ಮಾಡೆಲ್, ಭಾರತದಲ್ಲಿರುವ GigSync ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ, ನಿಮ್ಮನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಓದುತ್ತದೆ. ಅದನ್ನು ಇಟ್ಟುಕೊಳ್ಳುವುದಿಲ್ಲ, ಬೇರೆ ಯಾರೂ ನೋಡುವುದಿಲ್ಲ. ನಿಮ್ಮ ಕಡಿಮೆ ದರದಂತಹ ಖಾಸಗಿ ಪ್ರಶ್ನೆಗಳ ಉತ್ತರಗಳು ಈ ಫೋನ್ ಬಿಟ್ಟು ಹೋಗುವುದಿಲ್ಲ. ಎಲ್ಲವೂ ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರಬೇಕೆಂದರೆ, ಇದನ್ನು ಆಫ್ ಮಾಡಿ: ಆಗ ನಿಮ್ಮ ಮಾತುಗಳನ್ನು ಫೋನ್‌ನ ಸ್ವಂತ ಮಾಡೆಲ್ ಮಾತ್ರ ಓದುತ್ತದೆ, ಅಥವಾ ಯಾವುದೂ ಓದುವುದಿಲ್ಲ.",
  "page.blocked": "ನೀವು ಬ್ಲಾಕ್ ಮಾಡಿದವರು",
  "page.blocked_about": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಎಲ್ಲೆಡೆ ಮರೆಯಾಗಿರುತ್ತಾರೆ, ಮತ್ತೆ ಎಂದೂ ನಿಮ್ಮ ಜೊತೆ ಹೊಂದಿಸಲಾಗುವುದಿಲ್ಲ. ಬ್ಲಾಕ್ ಅನ್ನು ಇಲ್ಲಿಂದ ತೆಗೆಯಲು ಆಗುವುದಿಲ್ಲ.",
  "page.blocked_none": "ನೀವು ಯಾರನ್ನೂ ಬ್ಲಾಕ್ ಮಾಡಿಲ್ಲ.",
  "page.blocked_unnamed": "ನೀವು ಎಂದೂ ಕೆಲಸ ಮಾಡದವರು",
  "page.blocked_on": "{date} ರಂದು ಬ್ಲಾಕ್ ಮಾಡಲಾಗಿದೆ",
  // Settings
  "page.settings_title": "ನೀವು ಮತ್ತು ನಿಮ್ಮ ಏಜೆಂಟ್.",
  "page.settings_soft": "ಅದು ಹೇಗೆ ಚೌಕಾಸಿ ಮಾಡುತ್ತದೆ, ಮಾತಾಡುತ್ತದೆ, ಕಾಣುತ್ತದೆ ಮತ್ತು ನಡೆಯುತ್ತದೆ. ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
};
