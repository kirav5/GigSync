import type { net as en } from "../en/net.js";

/** Kannada: what the app says when the server does not answer or the phone has no internet. */
export const net: Readonly<Record<keyof typeof en, string>> = {
  "net.timeout": "GigSync ಉತ್ತರಿಸಲಿಲ್ಲ. ಇಂಟರ್ನೆಟ್ ನೋಡಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "net.no_internet": "ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. ಇಂಟರ್ನೆಟ್ ಸಿಕ್ಕಾಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "net.too_many": "ತುಂಬಾ ಸಲ ಪ್ರಯತ್ನಿಸಲಾಗಿದೆ. ಒಂದು ನಿಮಿಷ ಕಾದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};
