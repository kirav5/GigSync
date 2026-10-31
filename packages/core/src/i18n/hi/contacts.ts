import type { contacts as en } from "../en/contacts.js";

/** Hindi: contact details deleted once a job is settled, "Report a problem", and restored jobs. */
export const contacts: Readonly<Record<keyof typeof en, string>> = {
  "contacts.removed": "काम निपटने के बाद संपर्क विवरण हटा दिए गए।",
  "contacts.restored": "आपके रिकॉर्ड से वापस लाया गया",
  "contacts.restored_price": "{price} पर तय",
  "problem.report": "समस्या बताएं",
  "problem.title": "क्या गलत हुआ?",
  "problem.reason.not_paid": "पैसे नहीं मिले",
  "problem.reason.work_unfinished": "काम पूरा नहीं हुआ",
  "problem.reason.damage": "कुछ नुकसान हुआ",
  "problem.reason.behaviour": "बुरा व्यवहार",
  "problem.reason.other": "कुछ और",
  "problem.words": "कुछ शब्द (चाहें तो)",
  "problem.send": "बताएं",
  "problem.cancel": "रद्द करें",
  "problem.open_mine": "आपने समस्या बताई: {reason}।",
  "problem.open_theirs": "{name} ने समस्या बताई: {reason}।",
  "problem.holds": "हल होने तक संपर्क विवरण रखे जाएंगे, ज़्यादा से ज़्यादा {days} दिन।",
  "problem.resolve": "हल हो गया",
  "problem.resolved": "समस्या हल मान ली गई।",
  "problem.not_told": "उनका ऐप पुराना है, इसलिए अभी सिर्फ़ इस फ़ोन को इसकी जानकारी है।",
};
