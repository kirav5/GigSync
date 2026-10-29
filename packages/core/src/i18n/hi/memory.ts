import type { memory as en } from "../en/memory.js";

/** Hindi: what the agent remembers from past jobs, and the Find chat's "same as last time" chips. */
export const memory: Readonly<Record<keyof typeof en, string>> = {
  "memory.title": "मेरे एजेंट को क्या याद है",
  "memory.about": "सिर्फ़ इसी फ़ोन पर रहता है, ताकि आपका एजेंट दोबारा न पूछे। साइन आउट करने पर मिट जाता है।",
  "memory.empty": "अभी कुछ नहीं। जिस काम पर आप दोनों ने साइन किया, उससे एजेंट ने जो सीखा वह यहाँ दिखेगा।",
  "memory.area": "आपका इलाका",
  "memory.unnamed": "जिनके साथ आपने काम किया",
  "memory.jobs.one": "साथ में {count} काम",
  "memory.jobs.other": "साथ में {count} काम",
  "memory.last_on": "पिछला काम {date}",
  "memory.last_price": "पिछली तय कीमत {price}",
  "memory.they_said": "उन्होंने बताया",
  "memory.asked": "{trade} के कामों में पूछा गया",
  "memory.forget": "भूल जाएँ",
  "memory.forget_all": "सब भूल जाएँ",
  "memory.same_area": "पिछली बार जैसा ({area})",
  "memory.same_value": "पिछली बार जैसा: {value}",
};
