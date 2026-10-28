import type { shell as en } from "../en/shell.js";

/** Kannada: the tab bar, the back button, Profile, and Find's When chips. */
export const shell: Readonly<Record<keyof typeof en, string>> = {
  "nav.talk": "ಮಾತಾಡಿ",
  "nav.passbook": "ಪಾಸ್‌ಬುಕ್",
  "nav.profile": "ಪ್ರೊಫೈಲ್",
  "a11y.tabs": "ಮುಖ್ಯ ವಿಭಾಗಗಳು",
  "a11y.back": "ಹಿಂದಕ್ಕೆ",
  "profile.card_off": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಈಗ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಇಲ್ಲ",
  "profile.talk_card": "ಮಾತಾಡಿ ಬದಲಾಯಿಸಿ",
  "profile.more": "ಇನ್ನಷ್ಟು ಸೆಟ್ಟಿಂಗ್ಸ್",
  "profile.language": "ಭಾಷೆ",
  "when.today": "ಇಂದು",
  "when.tomorrow": "ನಾಳೆ",
  "when.pick": "ದಿನಾಂಕ ಆರಿಸಿ",
  "when.daily": "ಪ್ರತಿದಿನ",
  "when.time": "ಸಮಯ (ಬೇಕಾದರೆ)",
};
