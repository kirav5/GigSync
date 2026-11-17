import type { ledger as en } from "../en/ledger.js";

/** Kannada: the Money and Pay tabs and the worker's record. */
export const ledger: Readonly<Record<keyof typeof en, string>> = {
  // The worker's Money tab: this week, this month, and who the money still waits on
  "ledger.week_count.one": "{count} ಪಾವತಿ",
  "ledger.week_count.other": "{count} ಪಾವತಿಗಳು",
  "ledger.this_month": "ಈ ತಿಂಗಳು",
  "ledger.today": "ಇಂದು {price}",
  "ledger.waiting_from": "{name} ಅವರಿಂದ ಬರಬೇಕಿದೆ",
  "ledger.waiting_many": "{count} ಮನೆಗಳಿಂದ ಬರಬೇಕಿದೆ",
  "ledger.upi_line": "ನಿಮ್ಮ UPI: {vpa}",
  "ledger.upi_change": "'ನನ್ನ ಬಗ್ಗೆ'ಯಲ್ಲಿ ಬದಲಿಸಿ",
  "ledger.upi_none": "ಇನ್ನೂ ಯಾವ UPI ID ಉಳಿಸಿಲ್ಲ.",
  "ledger.upi_add": "'ನನ್ನ ಬಗ್ಗೆ'ಯಲ್ಲಿ ಸೇರಿಸಿ",
  // The household's Pay tab and the receipts it downloads
  "ledger.not_confirmed": "ಇನ್ನೂ ಖಚಿತವಾಗಿಲ್ಲ",
  "ledger.download_receipts": "ರಸೀದಿಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
  "ledger.receipts_about": "GigSync ನಿಮಗಾಗಿ ಇಟ್ಟಿರುವ ಪ್ರತಿಯೊಂದು ಕೆಲಸ, ನೀವು ಕೊಟ್ಟ ಹಣದ ಜೊತೆಗೆ, ಯಾರಿಗಾದರೂ ತೋರಿಸಲು.",
  "ledger.receipts_empty": "ಇನ್ನೂ ಯಾವ ಕೆಲಸವೂ ಇಟ್ಟಿಲ್ಲ. ನೀವು ಮತ್ತು ಕೆಲಸಗಾರರು ಇಬ್ಬರೂ ಸಹಿ ಮಾಡಿದ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.",
  "ledger.col_paid": "ಕೊಟ್ಟದ್ದು, ಖಚಿತ (₹)",
  "ledger.by_worker": "ಕೆಲಸಗಾರರು ಮಾತ್ರ",
  // My record, from the worker's Me
  "ledger.record_none": "ನೀವು ಮತ್ತು ಮನೆಯವರು ಇಬ್ಬರೂ ಸಹಿ ಮಾಡುವ ಕೆಲಸಗಳು ಇಲ್ಲಿ ಸೇರುತ್ತವೆ.",
  "ledger.on_card": "ನಿಮ್ಮ ಕಾರ್ಡ್‌ನಲ್ಲಿ",
  "ledger.share_lead": "ನೀವು ಬಯಸಿದಾಗ, ಇದರ ಒಂದು ಭಾಗವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
  "ledger.share_card": "ನನ್ನ ಕಾರ್ಡ್ ತೋರಿಸಿ",
  "ledger.share_card_sub": "ಮುಗಿಸಿದ ಕೆಲಸಗಳು ಮತ್ತು ನಿಮ್ಮ ರೇಟಿಂಗ್, ಯಾವ ಮೊತ್ತವೂ ಇಲ್ಲ",
  "ledger.share_job": "ಒಂದು ಕೆಲಸದ ರಸೀದಿಗಳು",
  "ledger.share_job_sub": "ಒಂದು ಕೆಲಸದ ದಾಖಲೆ ಫೈಲ್ ಆಗಿ, ಯಾರಿಗಾದರೂ ತೋರಿಸಲು",
  "ledger.job_missing": "GigSync ಬಳಿ ಈ ಕೆಲಸದ ದಾಖಲೆ ಇನ್ನೂ ಇಲ್ಲ. ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};
