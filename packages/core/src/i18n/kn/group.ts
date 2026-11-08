import type { group as en } from "../en/group.js";

/** ಕೆಲಸದ ಪ್ರಕಾರಗಳ ಗುಂಪುಗಳು (ADR 0061). */
export const group: Readonly<Record<keyof typeof en, string>> = {
  "group.house_help": "ಮನೆ ಕೆಲಸ",
  "group.home_repairs": "ಮನೆ ರಿಪೇರಿ",
  "group.appliances": "ಗೃಹೋಪಯೋಗಿ ಉಪಕರಣಗಳು",
  "group.electronics": "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್",
  "group.cleaning": "ಸ್ವಚ್ಛತೆ",
  "group.care": "ಆರೈಕೆ",
  "group.personal": "ವೈಯಕ್ತಿಕ",
  "group.vehicles": "ವಾಹನಗಳು",
  "group.outdoor": "ಹೊರಗಿನ ಕೆಲಸ ಮತ್ತು ಸಾಗಣೆ",
  "group.teaching": "ಕಲಿಸುವುದು",
  "group.events": "ಕಾರ್ಯಕ್ರಮಗಳು",
  "need.pick_group": "ಯಾವ ರೀತಿಯ ಕೆಲಸ? ಒಂದು ಗುಂಪನ್ನು ಆರಿಸಿ.",
  "need.all_groups": "ಎಲ್ಲಾ ರೀತಿಯ ಕೆಲಸ",
  "need.group_others": "{group} ನಲ್ಲಿ ಇನ್ನಷ್ಟು:",
  "iv.ask.also": "ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ಕೆಲಸವನ್ನೂ ಮಾಡುತ್ತೀರಾ? ಪ್ರತಿಯೊಂದನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ, ನಂತರ ಮುಗಿಯಿತು.",
  "card.all_work": "ಎಲ್ಲಾ ರೀತಿಯ ಕೆಲಸ ತೋರಿಸಿ",
};
