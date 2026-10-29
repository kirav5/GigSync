import type { record as en } from "../en/record.js";

/** Kannada: the worker's record inside Passbook. */
export const record: Readonly<Record<keyof typeof en, string>> = {
  "record.title": "ಮಾಡಿದ ಕೆಲಸಗಳು",
  "record.jobs.one": "{count} ಕೆಲಸ ಮಾಡಿದ್ದೀರಿ",
  "record.jobs.other": "{count} ಕೆಲಸಗಳನ್ನು ಮಾಡಿದ್ದೀರಿ",
  "record.households.one": "{count} ಮನೆ",
  "record.households.other": "{count} ಮನೆಗಳು",
  "record.since": "{month}ನಿಂದ",
  "record.state_received": "{price} ಬಂದಿದೆ",
  "record.state_cash": "{price} ನಗದು ಬಂದಿದೆ",
  "record.state_waiting": "ಹಣಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "record.state_not_asked": "ಇನ್ನೂ ಕೇಳಿಲ್ಲ",
  "record.state_cancelled": "ರದ್ದಾಗಿದೆ",
  "record.hired": "ಸಹಾಯಕರಿಗೆ ಕೊಟ್ಟ ಹಣ",
  "record.hired_paid": "{price} ಕೊಟ್ಟಿದ್ದೀರಿ",
  "record.hired_unpaid": "ಇನ್ನೂ ಕೊಟ್ಟಿಲ್ಲ",
  "record.open": "ಈ ಕೆಲಸ ನೋಡಿ",
  "record.close": "ಈ ಕೆಲಸ ಮರೆಮಾಡಿ",
  "record.empty": "GigSync ನಲ್ಲಿ ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",
};
