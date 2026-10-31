import type { home as en } from "../en/home.js";

/** Kannada: Activity: what the agents are doing, its counters and sections, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  // Activity, as collab's: the headline, the four counters and what each says when empty
  "activity.headline": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳು ಏನು ಮಾಡುತ್ತಿವೆ",
  "activity.tabs": "ನಿಮ್ಮ ಕೆಲಸಗಳು, ಎಲ್ಲಿವರೆಗೆ ಬಂದಿವೆ",
  "activity.tab_awaiting": "ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "activity.tab_talks": "ಮಾತುಕತೆಯಲ್ಲಿ",
  "activity.tab_agreed": "ಒಪ್ಪಿದವು",
  "activity.tab_closed": "ಮುಗಿದವು",
  "activity.standing_by": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳು ಸಿದ್ಧವಾಗಿವೆ.",
  "activity.awaiting.one": "{count} ನಿರ್ಧಾರ ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿದೆ.",
  "activity.awaiting.other": "{count} ನಿರ್ಧಾರಗಳು ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿವೆ.",
  "activity.talking.one": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳು {count} ಮಾತುಕತೆಯಲ್ಲಿವೆ.",
  "activity.talking.other": "ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳು {count} ಮಾತುಕತೆಗಳಲ್ಲಿವೆ.",
  "activity.empty_awaiting": "ನಿಮಗಾಗಿ ಏನೂ ಕಾಯುತ್ತಿಲ್ಲ. ನಿರ್ಧಾರ ನಿಮ್ಮದಾದಾಗ ಮಾತ್ರ ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳು ಕೇಳುತ್ತವೆ.",
  "activity.empty_talks": "ಈಗ ಯಾವ ಮಾತುಕತೆಯೂ ನಡೆಯುತ್ತಿಲ್ಲ.",
  "activity.empty_agreed": "ಇನ್ನೂ ಏನೂ ಒಪ್ಪಿಲ್ಲ.",
  "activity.hint_worker":
    "ಚಾಟ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಏಜೆಂಟ್‌ಗೆ ಹೇಳಿ: “ನಾನು ಮನೆಗೆ ಬಣ್ಣ ಹಚ್ಚುತ್ತೇನೆ, ದಿನಕ್ಕೆ ₹800”. ಮನೆಯವರ ರಿಕ್ವೆಸ್ಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "activity.hint_household": "ಚಾಟ್‌ನಲ್ಲಿ ಏನಾದರೂ ಕೇಳಿ: “ಶನಿವಾರ ಪೇಂಟರ್ ಬೇಕು”. ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗಳ ಕೆಲಸ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  "activity.records_line": "ಮುಗಿದ ಕೆಲಸಗಳು ದಾಖಲೆಗಳಲ್ಲಿವೆ.",
  "activity.records_open": "ದಾಖಲೆಗಳನ್ನು ತೆರೆಯಿರಿ",
  // The sections inside Agreed, and the worker's card nudges
  "home.today": "ಇಂದಿನ ಕೆಲಸಗಳು",
  "home.upcoming": "ಮುಂದಿನ ಕೆಲಸಗಳು",
  "home.other": "ಇತರ ಕೆಲಸಗಳು",
  "home.jobs": "ನಿಮ್ಮ ಕೆಲಸಗಳು",
  "home.no_card": "ಹತ್ತಿರದ ಗ್ರಾಹಕರು ನಿಮ್ಮನ್ನು ಹುಡುಕಲು ನಿಮ್ಮ ಕಾರ್ಡ್ ಮಾಡಿ.",
  "home.make_card": "ಮಾತಾಡಿ ಕಾರ್ಡ್ ಮಾಡಿ",
  "home.card_off": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಇಲ್ಲ, ಹಾಗಾಗಿ ಹೊಸ ಗ್ರಾಹಕರಿಗೆ ನೀವು ಸಿಗುವುದಿಲ್ಲ.",
  "home.details": "ವಿವರಗಳು",
  "home.say_approve": "ಹೊಸ ರಿಕ್ವೆಸ್ಟ್: {name} ಅವರಿಗೆ {trade} ಬೇಕು. ನೋಡಿ ನಿರ್ಧರಿಸಿ.",
  "home.say_answer": "{name} ಅವರ ಏಜೆಂಟ್ ನಿಮಗೆ ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿದೆ.",
  "home.say_sign": "{name} ಅವರು {price}ಗೆ ಒಪ್ಪಿದ್ದಾರೆ. ನೀವು ಸಹಿ ಮಾಡುತ್ತೀರಾ?",
  "home.say_paid": "{name} ಅವರು {price} ಕಳುಹಿಸಿದ್ದೇವೆ ಎನ್ನುತ್ತಾರೆ. ಹಣ ನಿಮಗೆ ತಲುಪಿತೇ?",
};
