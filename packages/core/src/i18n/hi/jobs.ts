import type { jobs as en } from "../en/jobs.js";

/** Hindi: the worker's Home and the Jobs tab: money first, what needs you, today, and the three groups of jobs. */
export const jobs: Readonly<Record<keyof typeof en, string>> = {
  // A job's row: the word at its end, in rust when the move is the owner's
  "jobs.word.answer": "जवाब दें",
  "jobs.word.sign": "दस्तख़त करें",
  "jobs.word.decide": "फ़ैसला करें",
  "jobs.word.check": "जाँचें",
  "jobs.word.pay": "{price} चुकाएँ",
  "jobs.word.ask": "{price} माँगें",
  "jobs.word.review": "राय दें",
  "jobs.word.set_off": "निकल पड़े?",
  "jobs.word.talks": "बातचीत में",
  // ...and the line under the name, after the work
  "jobs.line.reached": "एजेंटों ने {price} तय किया",
  "jobs.line.questions.one": "आपके लिए {count} सवाल",
  "jobs.line.questions.other": "आपके लिए {count} सवाल",
  "jobs.line.new_time": "{when} आ सकते हैं",
  "jobs.line.time_passed": "माँगा गया समय निकल गया",
  "jobs.line.take_over": "एजेंट राज़ी नहीं हो पाए",
  "jobs.line.request": "नई रिक्वेस्ट, देख लीजिए",
  "jobs.line.paid": "कहते हैं {price} भेज दिए",
  "jobs.line.turn": "{max} में से बारी {n}",
  // Home: the money card under the week's total, and the way into Talk
  "jobs.payments.one": "{count} भुगतान",
  "jobs.payments.other": "{count} भुगतान",
  "jobs.waiting_from": "{names} से {price} आना बाकी",
  "jobs.talk_sub": "किसी काम, अपने पैसे या कार्ड के बारे में पूछिए",
};
