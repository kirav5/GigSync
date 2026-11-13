import type { shell as en } from "../en/shell.js";

/** Kannada: the app's frame (the menu, its rows, the top bar), the screens the menu opens, and Find's When chips. */
export const shell: Readonly<Record<keyof typeof en, string>> = {
  "nav.talk": "ಮಾತಾಡಿ",
  "nav.activity": "ಚಟುವಟಿಕೆ",
  "nav.records": "ದಾಖಲೆಗಳು",
  "nav.about": "ನನ್ನ ಬಗ್ಗೆ",
  "nav.privacy": "ಗೌಪ್ಯತೆ",
  "nav.settings": "ಸೆಟ್ಟಿಂಗ್ಸ್",
  "a11y.back": "ಹಿಂದಕ್ಕೆ",
  "shell.menu": "ಮೆನು",
  "shell.drawer": "GigSync ಮೆನು",
  "shell.need_you.one": "{count} ಕೆಲಸ ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "shell.need_you.other": "{count} ಕೆಲಸಗಳು ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿವೆ",
  "shell.edit_card": "ನನ್ನ ಕಾರ್ಡ್ ಬದಲಿಸಿ",
  "profile.card_off": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಈಗ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಇಲ್ಲ",
  "profile.language": "ಭಾಷೆ",
  "when.today": "ಇಂದು",
  "when.tomorrow": "ನಾಳೆ",
  "when.pick": "ದಿನಾಂಕ ಆರಿಸಿ",
  "when.daily": "ಪ್ರತಿದಿನ",
  "perm.not_now": "ಈಗ ಬೇಡ",
};
