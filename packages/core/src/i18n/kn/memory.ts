import type { memory as en } from "../en/memory.js";

/** Kannada: what the agent remembers from past jobs, what the agent says using it, and its setting. */
export const memory: Readonly<Record<keyof typeof en, string>> = {
  "memory.title": "ನನ್ನ ಏಜೆಂಟ್‌ಗೆ ಏನು ನೆನಪಿದೆ",
  "memory.about":
    "ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇರುತ್ತದೆ, ನಿಮ್ಮ ಏಜೆಂಟ್ ಮತ್ತೆ ಕೇಳಬಾರದು ಎಂದು. ಸೈನ್ ಔಟ್ ಮಾಡಿದರೂ ಉಳಿಯುತ್ತದೆ; ಇಲ್ಲಿ ಸೈನ್ ಇನ್ ಮಾಡುವ ಬೇರೆ ಯಾರಿಗೂ ಕಾಣಿಸುವುದಿಲ್ಲ.",
  "memory.empty": "ಇನ್ನೂ ಏನೂ ಇಲ್ಲ. ನೀವಿಬ್ಬರೂ ಸಹಿ ಮಾಡಿದ ಕೆಲಸದ ನಂತರ, ಏಜೆಂಟ್ ಕಲಿತದ್ದು ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.",
  "memory.area": "ನಿಮ್ಮ ಪ್ರದೇಶ",
  "memory.unnamed": "ನೀವು ಕೆಲಸ ಮಾಡಿದವರು",
  "memory.jobs.one": "ಜೊತೆಯಲ್ಲಿ {count} ಕೆಲಸ",
  "memory.jobs.other": "ಜೊತೆಯಲ್ಲಿ {count} ಕೆಲಸಗಳು",
  "memory.last_on": "ಕೊನೆಯ ಕೆಲಸ {date}",
  "memory.last_price": "ಕೊನೆಯ ಒಪ್ಪಿದ ಬೆಲೆ {price}",
  "memory.they_said": "ಅವರು ಹೇಳಿದ್ದು",
  "memory.asked": "{trade} ಕೆಲಸಗಳಲ್ಲಿ ಕೇಳಿದ್ದು",
  "memory.forget": "ಮರೆತುಬಿಡಿ",
  "memory.show.one": "ನೆನಪಿನಲ್ಲಿರುವುದನ್ನು ನೋಡಿ ({count})",
  "memory.show.other": "ನೆನಪಿನಲ್ಲಿರುವುದನ್ನು ನೋಡಿ ({count})",
  "memory.forget_all": "ಎಲ್ಲವನ್ನೂ ಮರೆತುಬಿಡಿ",
  "memory.offer_detail": "ಹಿಂದಿನ ಕೆಲಸದಿಂದ, {detail}: {value}. ಇದನ್ನೇ ಬಳಸಲೇ?",
  "memory.offer_detail_old": "ಒಂದು ವರ್ಷದ ಹಿಂದೆ ಇದು ತಿಳಿದಿತ್ತು, {detail}: {value}. ಈಗಲೂ ಸರಿಯೇ?",
  "memory.filled_detail": "ಹಿಂದಿನ ಕೆಲಸದಿಂದ {detail}: {value} ಎಂದು ಹಾಕಿದ್ದೇನೆ.",
  "memory.offer_area": "ಹಿಂದಿನ ಕೆಲಸದಿಂದ, ನಿಮ್ಮ ಪ್ರದೇಶ: {area}. ಇದನ್ನೇ ಬಳಸಲೇ?",
  "memory.offer_area_old": "ಒಂದು ವರ್ಷದ ಹಿಂದೆ ನಿಮ್ಮ ಪ್ರದೇಶ {area} ಆಗಿತ್ತು. ಈಗಲೂ ಸರಿಯೇ?",
  "memory.filled_area": "ಹಿಂದಿನ ಕೆಲಸದಿಂದ ನಿಮ್ಮ ಪ್ರದೇಶ {area} ಎಂದು ಹಾಕಿದ್ದೇನೆ.",
  "memory.use": "ಹೌದು, ಇದನ್ನೇ ಬಳಸಿ",
  "memory.change": "ಬದಲಿಸಿ",
  "memory.change_detail": "{detail} ಬದಲಿಸಿ",
  "memory.change_area": "ಪ್ರದೇಶ ಬದಲಿಸಿ",
  "memory.answer_label": "ಹಿಂದಿನ ಕೆಲಸಗಳಿಂದ ನನ್ನ ಏಜೆಂಟ್‌ಗೆ ಉತ್ತರ ತಿಳಿದಿದ್ದಾಗ",
  "memory.answer_ask": "ಮೊದಲು ನನ್ನನ್ನು ಕೇಳಿ",
  "memory.answer_auto": "ನನ್ನ ಪರವಾಗಿ ಉತ್ತರಿಸಿ",
};
