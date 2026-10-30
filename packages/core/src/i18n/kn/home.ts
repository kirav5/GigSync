import type { home as en } from "../en/home.js";

/** Kannada: Today and My jobs: the day's sections, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  "home.title": "ಇಂದು, {date}",
  "home.decide": "ಈಗ ನಿರ್ಧರಿಸಿ",
  "home.today": "ಇಂದಿನ ಕೆಲಸಗಳು",
  "home.empty_today": "ಇಂದಿಗೆ ಯಾವ ಕೆಲಸವೂ ನಿಗದಿಯಾಗಿಲ್ಲ.",
  "home.upcoming": "ಮುಂದಿನ ಕೆಲಸಗಳು",
  "home.other": "ಇತರ ಕೆಲಸಗಳು",
  "home.jobs": "ನಿಮ್ಮ ಕೆಲಸಗಳು",
  "home.talking.one": "ನಿಮ್ಮ ಏಜೆಂಟ್ {count} ಗ್ರಾಹಕರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "home.talking.other": "ನಿಮ್ಮ ಏಜೆಂಟ್ {count} ಗ್ರಾಹಕರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "home.talking_workers.one": "ನಿಮ್ಮ ಏಜೆಂಟ್ {count} ಕೆಲಸಗಾರರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "home.talking_workers.other": "ನಿಮ್ಮ ಏಜೆಂಟ್ {count} ಕೆಲಸಗಾರರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "home.earlier": "ಹಿಂದಿನ ಕೆಲಸಗಳು",
  "home.empty": "ಇನ್ನೂ ಯಾವ ಕೆಲಸವೂ ಇಲ್ಲ. ಗ್ರಾಹಕರು ಕೇಳಿದಾಗ ಇಲ್ಲೇ ಕಾಣಿಸುತ್ತದೆ.",
  "home.no_card": "ಹತ್ತಿರದ ಗ್ರಾಹಕರು ನಿಮ್ಮನ್ನು ಹುಡುಕಲು ನಿಮ್ಮ ಕಾರ್ಡ್ ಮಾಡಿ.",
  "home.make_card": "ಮಾತಾಡಿ ಕಾರ್ಡ್ ಮಾಡಿ",
  "home.card_off": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಇಲ್ಲ, ಹಾಗಾಗಿ ಹೊಸ ಗ್ರಾಹಕರಿಗೆ ನೀವು ಸಿಗುವುದಿಲ್ಲ.",
  "home.details": "ವಿವರಗಳು",
  "home.passbook_hint": "ನಿಮಗೆ ಬಂದ ಹಣ “ರಸೀದಿಗಳು” ಅಡಿಯಲ್ಲಿ ನಿಮ್ಮ ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿ ದಾಖಲಾಗುತ್ತದೆ.",
  "home.say_approve": "ಹೊಸ ರಿಕ್ವೆಸ್ಟ್: {name} ಅವರಿಗೆ {trade} ಬೇಕು. ನೋಡಿ ನಿರ್ಧರಿಸಿ.",
  "home.say_answer": "{name} ಅವರ ಏಜೆಂಟ್ ನಿಮಗೆ ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿದೆ.",
  "home.say_sign": "{name} ಅವರು {price}ಗೆ ಒಪ್ಪಿದ್ದಾರೆ. ನೀವು ಸಹಿ ಮಾಡುತ್ತೀರಾ?",
  "home.say_paid": "{name} ಅವರು {price} ಕಳುಹಿಸಿದ್ದೇವೆ ಎನ್ನುತ್ತಾರೆ. ಹಣ ನಿಮಗೆ ತಲುಪಿತೇ?",
};
