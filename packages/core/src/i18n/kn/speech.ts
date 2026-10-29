import type { speech as en } from "../en/speech.js";

/** Kannada: voice: the mic, reading aloud, and the owner's consent before a cloud recognizer hears them. */
export const speech: Readonly<Record<keyof typeof en, string>> = {
  "speech.listen": "ಮಾತಾಡಿ ಉತ್ತರಿಸಿ",
  "speech.stop": "ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
  "speech.listening": "ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ…",
  "speech.unavailable": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಇನ್ನೂ {lang} ಭಾಷೆಯಲ್ಲಿ ಮಾತಾಡಿ ಬರೆಯಲು ಆಗುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.",
  "speech.download": "{lang} ಭಾಷೆಯ ಧ್ವನಿ ಟೈಪಿಂಗ್ ಪಡೆಯಿರಿ (ಈ ಫೋನ್‌ಗೆ ಒಮ್ಮೆ ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತದೆ)",
  "speech.denied": "GigSync ಗೆ ಮೈಕ್ ಬಳಸಲು ಆಗುತ್ತಿಲ್ಲ. ಫೋನ್ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಅನುಮತಿ ಕೊಡಿ.",
  "speech.didnt_hear": "ನನಗೆ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ, ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.",
  "speech.title": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಧ್ವನಿ",
  "speech.about": "ನೀವು ಹೇಳಿದ್ದು ಬರಹವಾಗುತ್ತದೆ. ಸಾಧ್ಯವಾದಾಗ ಈ ಫೋನೇ ಅದನ್ನು ಮಾಡುತ್ತದೆ; ಇಲ್ಲದಿದ್ದರೆ ನೀವು ಅನುಮತಿ ಕೊಟ್ಟ ಮೇಲೆ ಮಾತ್ರ.",
  "speech.listen_state": "{lang} ಭಾಷೆಯ ಧ್ವನಿ ಟೈಪಿಂಗ್: {state}",
  "speech.speak_state": "{lang} ಭಾಷೆಯಲ್ಲಿ ಓದಿ ಹೇಳುವುದು: {state}",
  "speech.replay": "ಮತ್ತೆ ಕೇಳಿ",
  "speech.state_denied": "ಮೈಕ್‌ಗೆ ಅನುಮತಿ ಇಲ್ಲ",
  "speech.cloud_ask":
    "ಈ ಫೋನ್‌ಗೆ ತಾನಾಗಿಯೇ {lang} ಮಾತು ಅರ್ಥವಾಗುವುದಿಲ್ಲ. ಧ್ವನಿ ಬಳಸಬೇಕಾದರೆ, ಅದನ್ನು ಬರಹವಾಗಿಸಲು ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು {vendor}‌ಗೆ ಕಳುಹಿಸಬೇಕಾಗುತ್ತದೆ. ಅನುಮತಿ ಕೊಡುತ್ತೀರಾ?",
  "speech.cloud_yes": "ಅನುಮತಿ ಕೊಡಿ",
  "speech.cloud_no": "ನಾನು ಟೈಪ್ ಮಾಡುತ್ತೇನೆ",
  "speech.cloud_on": "ನಿಮ್ಮ ಧ್ವನಿ ಬರಹವಾಗಲು {vendor}‌ಗೆ ಹೋಗುತ್ತದೆ.",
  "speech.cloud_withdraw": "ನನ್ನ ಧ್ವನಿ ಕಳುಹಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ",
  "speech.where_device": "ಧ್ವನಿ ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
  "speech.where_cloud": "ಧ್ವನಿಯನ್ನು ಬರಹವಾಗಿಸಲು {vendor}‌ಗೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
  "speech.vendor_google": "ಗೂಗಲ್",
  "speech.vendor_apple": "ಆ್ಯಪಲ್",
  "speech.vendor_browser": "ನಿಮ್ಮ ಬ್ರೌಸರ್ ಕಂಪನಿ",
  "speech.type_private": "ಇದನ್ನು ಟೈಪ್ ಮಾಡಿ. ಇದು ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ, ಹಾಗಾಗಿ ಇದನ್ನು {vendor}‌ಗೆ ಕಳುಹಿಸುವುದಿಲ್ಲ.",
};
