import type { progress as en } from "../en/progress.js";

/** Kannada: a signed job's progress line, and the actions on a job restored from the record. */
export const progress: Readonly<Record<keyof typeof en, string>> = {
  "progress.title": "ಕೆಲಸದ ಪ್ರಗತಿ",
  "progress.agreed": "ಒಪ್ಪಿಗೆ",
  "progress.on_my_way": "ದಾರಿಯಲ್ಲಿ",
  "progress.started": "ಶುರುವಾಯಿತು",
  "progress.done": "ಮುಗಿದಿದೆ",
  "progress.paid": "ಹಣ ಪಾವತಿ",
  "progress.closed": "ಮುಕ್ತಾಯ",
  "progress.cancelled": "ರದ್ದು",
  "progress.you": "ನೀವು",
  "restored.work_done": "ಕೆಲಸ ಮುಗಿದಿದೆ",
  "restored.cancel": "ಈ ಕೆಲಸ ರದ್ದುಮಾಡಿ",
  "restored.why": "ಈ ಕೆಲಸ ನಿಮ್ಮ GigSync ದಾಖಲೆಯಿಂದ ಮರಳಿ ಬಂದಿದೆ, ಹಾಗಾಗಿ ಬದಲಾವಣೆ ದಾಖಲೆಯ ಮೂಲಕ ಒಂದು ನಿಮಿಷದಲ್ಲಿ {name} ಅವರಿಗೆ ತಲುಪುತ್ತದೆ.",
  "restored.cancel_sure": "ಈ ಕೆಲಸವನ್ನು ನಿಮ್ಮಿಬ್ಬರಿಗೂ ರದ್ದುಮಾಡಬೇಕೇ?",
  "restored.cancel_yes": "ಹೌದು, ರದ್ದುಮಾಡಿ",
  "restored.keep": "ಇರಲಿ",
};
