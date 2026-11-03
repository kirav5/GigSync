import type { schedule as en } from "../en/schedule.js";

/** ಕೆಲಸಗಾರರ ಸ್ವಂತ ವೇಳಾಪಟ್ಟಿ (ADR 0048). */
export const schedule: Readonly<Record<keyof typeof en, string>> = {
  "card.schedule": "ವೇಳಾಪಟ್ಟಿ",
  "schedule.saved": "ನಿಮ್ಮ ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ:",
  "schedule.saved_clash": "ಉಳಿಸಲಾಗಿದೆ. ಇದು ನಿಮ್ಮ ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿರುವ ಇನ್ನೊಂದು ಕೆಲಸದ ಸಮಯಕ್ಕೆ ಸೇರುತ್ತದೆ; ಒಂದನ್ನು ಬದಲಿಸಬೇಕಾದರೆ ಗ್ರಾಹಕರಿಗೆ ಕರೆ ಮಾಡಿ:",
  "schedule.list": "ನಿಮ್ಮ ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿ:",
  "schedule.empty": "ನಿಮ್ಮ ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿ ಏನೂ ಇಲ್ಲ. ಬುಕಿಂಗ್ ಸೇರಿಸಲು ಹೇಳಿ: ನಾಳೆ 2 ರಿಂದ 3 ಗಂಟೆ ಬುಕಿಂಗ್ ಉಳಿಸಿ.",
  "schedule.free_day": "ಆ ದಿನ ಯಾವ ಬುಕಿಂಗ್ ಇಲ್ಲ.",
  "schedule.cancelled": "ವೇಳಾಪಟ್ಟಿಯಿಂದ ತೆಗೆಯಲಾಗಿದೆ:",
  "schedule.none_to_cancel": "ಆ ಸಮಯಕ್ಕೆ ಯಾವ ಬುಕಿಂಗ್ ಸಿಗಲಿಲ್ಲ. ಎಲ್ಲವನ್ನೂ ನೋಡಲು ಕೇಳಿ: ನನ್ನ ವೇಳಾಪಟ್ಟಿಯಲ್ಲಿ ಏನಿದೆ?",
  "schedule.which": "ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಬುಕಿಂಗ್ ಸಿಕ್ಕಿವೆ. ಅದರ ಸಮಯವನ್ನೂ ಹೇಳಿ:",
  "schedule.when": "{day}, {start} – {end}",
  "schedule.today": "ಇಂದು",
  "schedule.tomorrow": "ನಾಳೆ",
  "schedule.job": "GigSync ಕೆಲಸ: {when}",
  "schedule.title": "ನಿಮ್ಮ ಬುಕಿಂಗ್‌ಗಳು",
  "schedule.hint": "'ಮಾತಾಡಿ'ಯಲ್ಲಿ ನೀವು ಏಜೆಂಟ್‌ಗೆ ಹೇಳಿದ ಬುಕಿಂಗ್‌ಗಳು. ಈ ಸಮಯಗಳಲ್ಲಿ ಏಜೆಂಟ್ ಯಾವ ಕೆಲಸವನ್ನೂ ಒಪ್ಪುವುದಿಲ್ಲ.",
  "schedule.delete": "ಅಳಿಸಿ",
  "schedule.delete_named": "{when} ಅಳಿಸಿ",
  "schedule.soon": "{minutes} ನಿಮಿಷದಲ್ಲಿ ಶುರು",
  "schedule.remind_title": "ಬುಕಿಂಗ್: {time}",
  "schedule.remind_body": "{minutes} ನಿಮಿಷದಲ್ಲಿ ಶುರುವಾಗುತ್ತದೆ.",
};
