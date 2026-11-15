import type { speech as en } from "../en/speech.js";

/** Kannada: voice: the mic, reading aloud, and the owner's consent before a cloud recognizer hears them. */
export const speech: Readonly<Record<keyof typeof en, string>> = {
  "speech.listen": "ಮಾತಾಡಿ ಉತ್ತರಿಸಿ",
  "speech.done": "ಆಯಿತು",
  "speech.cancel": "ರದ್ದು ಮಾಡಿ",
  "speech.listening": "ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ…",
  "speech.listening_in": "{lang} ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ",
  "composer.ask": "ಏನಾದರೂ ಕೇಳಿ",
  "composer.more": "ಇನ್ನಷ್ಟು",
  "composer.more_title": "ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?",
  "composer.dictate": "ಮಾತಾಡಿ ಬರೆಯಿರಿ",
  "speech.unavailable": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಇನ್ನೂ {lang} ಭಾಷೆಯಲ್ಲಿ ಮಾತಾಡಿ ಬರೆಯಲು ಆಗುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.",
  "speech.fetching": "{lang} ಭಾಷೆಯ ಧ್ವನಿ ಟೈಪಿಂಗ್ ಬರುತ್ತಿದೆ… ಅಲ್ಲಿಯವರೆಗೆ ಟೈಪ್ ಮಾಡಿ",
  "speech.denied": "GigSync ಗೆ ಮೈಕ್ ಬಳಸಲು ಆಗುತ್ತಿಲ್ಲ. ಫೋನ್ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಅನುಮತಿ ಕೊಡಿ.",
  "speech.didnt_hear": "ನನಗೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
  "speech.title": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಧ್ವನಿ",
  "speech.replay": "ಮತ್ತೆ ಕೇಳಿ",
  "speech.cloud_ask":
    "ಈ ಫೋನ್‌ಗೆ ತಾನಾಗಿಯೇ {lang} ಮಾತು ಅರ್ಥವಾಗುವುದಿಲ್ಲ. ಧ್ವನಿ ಬಳಸಬೇಕಾದರೆ, ಅದನ್ನು ಬರಹವಾಗಿಸಲು ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು {vendor}‌ಗೆ ಕಳುಹಿಸಬೇಕಾಗುತ್ತದೆ. ಅನುಮತಿ ಕೊಡುತ್ತೀರಾ?",
  "speech.cloud_yes": "ಅನುಮತಿ ಕೊಡಿ",
  "speech.cloud_no": "ನಾನು ಟೈಪ್ ಮಾಡುತ್ತೇನೆ",
  "speech.cloud_on": "ನಿಮ್ಮ ಧ್ವನಿ ಬರಹವಾಗಲು {vendor}‌ಗೆ ಹೋಗುತ್ತದೆ.",
  "speech.cloud_withdraw": "ನನ್ನ ಧ್ವನಿ ಕಳುಹಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
  "speech.vendor_google": "ಗೂಗಲ್",
  "speech.vendor_apple": "ಆ್ಯಪಲ್",
  "speech.vendor_browser": "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಕಂಪನಿ",
  "speech.type_private": "ಇದನ್ನು ಟೈಪ್ ಮಾಡಿ. ಇದು ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ, ಹಾಗಾಗಿ ಇದನ್ನು {vendor}‌ಗೆ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
};
