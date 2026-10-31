import type { worker as en } from "../en/worker.js";

/** Kannada: the worker's own record: Today, jobs in person, getting paid, the record, Settings. */
export const worker: Readonly<Record<keyof typeof en, string>> = {
  "stat.waiting": "ಬಾಕಿ",
  "getpaid.cash": "ನಗದು ಬಂತು",
  "getpaid.scan": "ಪಾವತಿಸಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
  "getpaid.qr_alt": "{price} – {vpa} ಯುಪಿಐ ಕ್ಯೂಆರ್",
  "getpaid.to": "ಸ್ವೀಕರಿಸುವವರು: {name} · {vpa}",
  "getpaid.scan_about": "ಗ್ರಾಹಕರು ಯಾವುದೇ ಯುಪಿಐ ಆ್ಯಪ್‌ನಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡುತ್ತಾರೆ. ಹಣ ನೇರವಾಗಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಬರುತ್ತದೆ.",
  "payrow.ref": "ರೆಫ್ {utr}",
  "method.upi": "ಯುಪಿಐ",
  "method.cash": "ನಗದು",
  "settings.soft": "ಈ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.",
  "settings.paid_to": "ಹಣ ಇಲ್ಲಿಗೆ ಪಡೆಯಿರಿ",
  "settings.vpa": "ನಿಮ್ಮ ಯುಪಿಐ ಐಡಿ",
  "settings.name": "ಗ್ರಾಹಕರಿಗೆ ಕಾಣುವ ನಿಮ್ಮ ಹೆಸರು",
  "settings.saved": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ",
  "settings.change": "ಬದಲಿಸಿ",
  "settings.save": "ಉಳಿಸಿ",
  "settings.vpa_about":
    "ನಿಮ್ಮ ಪಾವತಿ ಕ್ಯೂಆರ್‌ನಲ್ಲಿ ಮಾತ್ರ ಕಾಣುತ್ತದೆ, ಅಥವಾ ನೀವು ಕೆಲಸ ಮಾಡುತ್ತಿರುವ ಗ್ರಾಹಕರಿಗೆ ಲಾಕ್ ಮಾಡಿ ಕಳುಹಿಸಲಾಗುತ್ತದೆ. ಸರ್ವರ್‌ನಲ್ಲಿ ಎಂದೂ ಇಡುವುದಿಲ್ಲ.",
  "settings.look": "ನೋಟ",
  "look.auto": "ತಾನಾಗಿಯೇ",
  "look.light": "ಲೈಟ್",
  "look.dark": "ಡಾರ್ಕ್",
  "settings.err_vpa": "ಇದು ಯುಪಿಐ ಐಡಿಯಂತೆ ಕಾಣುತ್ತಿಲ್ಲ (name@bank).",
  "settings.err_name": "ಗ್ರಾಹಕರು ಪಾವತಿಸುವಾಗ ಕಾಣುವ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.",
  "settings.err_name_long": "ಹೆಸರನ್ನು {max} ಅಕ್ಷರಗಳೊಳಗೆ ಇಡಿ.",
};
