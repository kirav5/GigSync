import type { jobs as en } from "../en/jobs.js";

/** Kannada: the worker's Home and the Jobs tab: money first, what needs you, today, and the three groups of jobs. */
export const jobs: Readonly<Record<keyof typeof en, string>> = {
  // A job's row: the word at its end, in rust when the move is the owner's
  "jobs.word.answer": "ಉತ್ತರಿಸಿ",
  "jobs.word.sign": "ಸಹಿ ಮಾಡಿ",
  "jobs.word.decide": "ನಿರ್ಧರಿಸಿ",
  "jobs.word.check": "ಪರಿಶೀಲಿಸಿ",
  "jobs.word.pay": "{price} ಪಾವತಿಸಿ",
  "jobs.word.ask": "{price} ಕೇಳಿ",
  "jobs.word.review": "ಅಭಿಪ್ರಾಯ ನೀಡಿ",
  "jobs.word.set_off": "ಹೊರಟಿರಾ?",
  "jobs.word.talks": "ಮಾತುಕತೆಯಲ್ಲಿ",
  // ...and the line under the name, after the work
  "jobs.line.reached": "ಏಜೆಂಟ್‌ಗಳು {price}ಗೆ ಒಪ್ಪಿದವು",
  "jobs.line.questions.one": "ನಿಮಗೆ {count} ಪ್ರಶ್ನೆ",
  "jobs.line.questions.other": "ನಿಮಗೆ {count} ಪ್ರಶ್ನೆಗಳು",
  "jobs.line.new_time": "{when} ಬರಬಹುದು",
  "jobs.line.time_passed": "ಕೇಳಿದ ಸಮಯ ಮುಗಿದಿದೆ",
  "jobs.line.take_over": "ಏಜೆಂಟ್‌ಗಳು ಒಪ್ಪಂದಕ್ಕೆ ಬರಲಿಲ್ಲ",
  "jobs.line.request": "ಹೊಸ ರಿಕ್ವೆಸ್ಟ್, ನೋಡಿ",
  "jobs.line.paid": "{price} ಕಳುಹಿಸಿದ್ದೇವೆ ಎನ್ನುತ್ತಾರೆ",
  "jobs.line.turn": "{max}ರಲ್ಲಿ {n}ನೇ ಸರದಿ",
  // Home: the money card under the week's total, and the way into Talk
  "jobs.payments.one": "{count} ಪಾವತಿ",
  "jobs.payments.other": "{count} ಪಾವತಿಗಳು",
  "jobs.waiting_from": "{names} ಅವರಿಂದ {price} ಬರಬೇಕಿದೆ",
  "jobs.talk_sub": "ಕೆಲಸ, ನಿಮ್ಮ ಹಣ ಅಥವಾ ಕಾರ್ಡ್ ಬಗ್ಗೆ ಕೇಳಿ",
};
