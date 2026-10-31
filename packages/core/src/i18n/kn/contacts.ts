import type { contacts as en } from "../en/contacts.js";

/** Kannada: contact details deleted once a job is settled, "Report a problem", and restored jobs. */
export const contacts: Readonly<Record<keyof typeof en, string>> = {
  "contacts.removed": "ಕೆಲಸ ಮುಗಿದ ನಂತರ ಸಂಪರ್ಕ ವಿವರಗಳನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ.",
  "contacts.restored": "ನಿಮ್ಮ ದಾಖಲೆಯಿಂದ ಮರಳಿ ತರಲಾಗಿದೆ",
  "contacts.restored_price": "{price}ಕ್ಕೆ ಒಪ್ಪಲಾಗಿದೆ",
  "problem.report": "ಸಮಸ್ಯೆ ತಿಳಿಸಿ",
  "problem.title": "ಏನು ತಪ್ಪಾಯಿತು?",
  "problem.reason.not_paid": "ಹಣ ಬಂದಿಲ್ಲ",
  "problem.reason.work_unfinished": "ಕೆಲಸ ಮುಗಿದಿಲ್ಲ",
  "problem.reason.damage": "ಏನೋ ಹಾನಿಯಾಗಿದೆ",
  "problem.reason.behaviour": "ಕೆಟ್ಟ ನಡವಳಿಕೆ",
  "problem.reason.other": "ಬೇರೆ ಏನೋ",
  "problem.words": "ಕೆಲವು ಮಾತುಗಳು (ಬೇಕಿದ್ದರೆ)",
  "problem.send": "ತಿಳಿಸಿ",
  "problem.cancel": "ರದ್ದುಮಾಡಿ",
  "problem.open_mine": "ನೀವು ಸಮಸ್ಯೆ ತಿಳಿಸಿದ್ದೀರಿ: {reason}.",
  "problem.open_theirs": "{name} ಸಮಸ್ಯೆ ತಿಳಿಸಿದ್ದಾರೆ: {reason}.",
  "problem.holds": "ಬಗೆಹರಿಯುವವರೆಗೆ ಸಂಪರ್ಕ ವಿವರಗಳನ್ನು ಇಡಲಾಗುತ್ತದೆ, ಹೆಚ್ಚೆಂದರೆ {days} ದಿನ.",
  "problem.resolve": "ಬಗೆಹರಿದಿದೆ",
  "problem.resolved": "ಸಮಸ್ಯೆ ಬಗೆಹರಿದಿದೆ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ.",
  "problem.not_told": "ಅವರ ಆ್ಯಪ್ ಹಳೆಯದು, ಆದ್ದರಿಂದ ಸದ್ಯಕ್ಕೆ ಈ ಫೋನ್‌ಗೆ ಮಾತ್ರ ಇದು ಗೊತ್ತು.",
};
