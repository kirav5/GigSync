import type { home as en } from "../en/home.js";

/** Kannada: The Jobs tab: its three sections and what each says when empty, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  // The Jobs tab: its heading, its three sections (needs you, agents talking, agreed) and the way to closed jobs
  "activity.headline": "ನಿಮ್ಮ ಕೆಲಸಗಳು",
  "activity.tab_awaiting": "ನಿಮ್ಮ ನಿರ್ಧಾರ ಬೇಕು",
  "activity.tab_talks": "ಸಹಾಯಕರ ಮಾತುಕತೆ",
  "activity.tab_agreed": "ಒಪ್ಪಿದವು",
  "activity.tab_closed": "ಮುಗಿದ ಕೆಲಸಗಳು",
  "activity.talking.one": "ನಿಮ್ಮ ಸಹಾಯಕ {count} ಮನೆಯವರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "activity.talking.other": "ನಿಮ್ಮ ಸಹಾಯಕ {count} ಮನೆಯವರ ಜೊತೆ ಮಾತಾಡುತ್ತಿದೆ",
  "activity.hint_worker":
    "ಚಾಟ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಸಹಾಯಕನಿಗೆ ಹೇಳಿ: “ನಾನು ಮನೆಗೆ ಬಣ್ಣ ಹಚ್ಚುತ್ತೇನೆ, ದಿನಕ್ಕೆ ₹800”. ಮನೆಯವರ ರಿಕ್ವೆಸ್ಟ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  "activity.hint_household": "ಚಾಟ್‌ನಲ್ಲಿ ಏನಾದರೂ ಕೇಳಿ: “ಶನಿವಾರ ಪೇಂಟರ್ ಬೇಕು”. ನಿಮ್ಮ ಸಹಾಯಕನ ಕೆಲಸ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  // The worker's Agreed by day, and their card nudges on Home
  "home.no_card": "ಹತ್ತಿರದ ಗ್ರಾಹಕರು ನಿಮ್ಮನ್ನು ಹುಡುಕಲು ನಿಮ್ಮ ಕಾರ್ಡ್ ಮಾಡಿ.",
  "home.make_card": "ಮಾತಾಡಿ ಕಾರ್ಡ್ ಮಾಡಿ",
  "home.card_off": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಬೋರ್ಡ್‌ನಲ್ಲಿ ಇಲ್ಲ, ಹಾಗಾಗಿ ಹೊಸ ಗ್ರಾಹಕರಿಗೆ ನೀವು ಸಿಗುವುದಿಲ್ಲ.",
  "home.details": "ವಿವರಗಳು",
  "home.say_approve": "ಹೊಸ ರಿಕ್ವೆಸ್ಟ್: {name} ಅವರಿಗೆ {trade} ಬೇಕು. ನೋಡಿ ನಿರ್ಧರಿಸಿ.",
  "home.say_answer": "{name} ಅವರ ಸಹಾಯಕ ನಿಮಗೆ ಕೆಲವು ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿದೆ.",
  "home.say_sign": "{name} ಅವರು {price}ಗೆ ಒಪ್ಪಿದ್ದಾರೆ. ನೀವು ಸಹಿ ಮಾಡುತ್ತೀರಾ?",
  "home.say_paid": "{name} ಅವರು {price} ಕಳುಹಿಸಿದ್ದೇವೆ ಎನ್ನುತ್ತಾರೆ. ಹಣ ನಿಮಗೆ ತಲುಪಿತೇ?",
};
