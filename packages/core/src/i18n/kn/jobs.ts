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
  "jobs.word.set_off": "ಹೊರಡುವ ಸಮಯ",
  // ...and the line under the name, after the work
  "jobs.line.reached": "ಸಹಾಯಕರು {price}ಗೆ ಒಪ್ಪಿದರು",
  "jobs.line.questions.one": "ನಿಮಗೆ {count} ಪ್ರಶ್ನೆ",
  "jobs.line.questions.other": "ನಿಮಗೆ {count} ಪ್ರಶ್ನೆಗಳು",
  "jobs.line.new_time": "{when} ಬರಬಹುದು",
  "jobs.line.time_passed": "ಕೇಳಿದ ಸಮಯ ಮುಗಿದಿದೆ",
  "jobs.line.take_over": "ಸಹಾಯಕರು ಒಪ್ಪಂದಕ್ಕೆ ಬರಲಿಲ್ಲ",
  "jobs.line.request": "ಹೊಸ ರಿಕ್ವೆಸ್ಟ್, ನೋಡಿ",
  "jobs.line.paid": "{price} ಕಳುಹಿಸಿದ್ದೇವೆ ಎನ್ನುತ್ತಾರೆ",
  "jobs.line.turn": "{max}ರಲ್ಲಿ {n}ನೇ ಸರದಿ",
  // The Jobs tab: the day a job is on, or was finished on, as a heading over its jobs
  "jobs.day.yesterday": "ನಿನ್ನೆ",
  "jobs.day.week": "ಈ ವಾರ",
  "jobs.day.coming": "ಮುಂದೆ",
  "jobs.day.earlier": "ಹಿಂದೆ",
  "jobs.day.other": "ಇತರ ದಿನಗಳು",
  // ...the finished jobs under the open ones, and the page with no jobs at all
  "jobs.done": "ಮುಗಿದವು",
  "jobs.empty": "ಇನ್ನೂ ಯಾವ ಕೆಲಸವೂ ಇಲ್ಲ",
  // Home: the money card under the week's total, and the way into Talk
  "jobs.payments.one": "{count} ಪಾವತಿ",
  "jobs.payments.other": "{count} ಪಾವತಿಗಳು",
};
