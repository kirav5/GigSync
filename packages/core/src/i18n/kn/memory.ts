import type { memory as en } from "../en/memory.js";

/** Kannada: what the agent remembers from past jobs, and the Find chat's "same as last time" chips. */
export const memory: Readonly<Record<keyof typeof en, string>> = {
  "memory.title": "ನನ್ನ ಏಜೆಂಟ್‌ಗೆ ಏನು ನೆನಪಿದೆ",
  "memory.about": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇರುತ್ತದೆ, ನಿಮ್ಮ ಏಜೆಂಟ್ ಮತ್ತೆ ಕೇಳಬಾರದು ಎಂದು. ಸೈನ್ ಔಟ್ ಮಾಡಿದಾಗ ಅಳಿಸಿಹೋಗುತ್ತದೆ.",
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
  "memory.forget_all": "ಎಲ್ಲವನ್ನೂ ಮರೆತುಬಿಡಿ",
  "memory.same_area": "ಹಿಂದಿನ ಬಾರಿಯಂತೆ ({area})",
  "memory.same_value": "ಹಿಂದಿನ ಬಾರಿಯಂತೆ: {value}",
};
