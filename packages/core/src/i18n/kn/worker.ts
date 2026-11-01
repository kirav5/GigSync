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
  "pack.title": "ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವ ಪ್ಯಾಕ್",
  "pack.about":
    "ಒಂದು ಸಣ್ಣ ಮಾಡೆಲ್ ({mb} ಎಂಬಿ, ಒಮ್ಮೆ ಡೌನ್‌ಲೋಡ್) ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ನಿಮ್ಮ ಮಾತನ್ನು ಈ ಫೋನ್‌ನಲ್ಲೇ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ. ನೀವು ಬರೆದದ್ದು ಫೋನಿನಿಂದ ಹೊರಗೆ ಹೋಗುವುದಿಲ್ಲ, ಮತ್ತು ಇದಿಲ್ಲದೆಯೂ ಎಲ್ಲವೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
  "pack.get": "ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ({mb} ಎಂಬಿ)",
  "pack.downloading": "ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ… {percent}%",
  "pack.ready": "ಸಿದ್ಧ · ಈ ಫೋನ್‌ನಲ್ಲೇ ಚಲಿಸುತ್ತದೆ",
  "pack.failed": "ಡೌನ್‌ಲೋಡ್ ಮುಗಿಯಲಿಲ್ಲ. ಸಂಪರ್ಕ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "pack.lite": "ಲೈಟ್ ಮೋಡ್‌ನಲ್ಲಿ ಆಫ್.",
  "settings.err_vpa": "ಇದು ಯುಪಿಐ ಐಡಿಯಂತೆ ಕಾಣುತ್ತಿಲ್ಲ (name@bank).",
  "settings.err_name": "ಗ್ರಾಹಕರು ಪಾವತಿಸುವಾಗ ಕಾಣುವ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.",
  "settings.err_name_long": "ಹೆಸರನ್ನು {max} ಅಕ್ಷರಗಳೊಳಗೆ ಇಡಿ.",
};
