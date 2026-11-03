import type { schedule as en } from "../en/schedule.js";

/** कामगार का अपना शेड्यूल (ADR 0048)। */
export const schedule: Readonly<Record<keyof typeof en, string>> = {
  "card.schedule": "शेड्यूल",
  "schedule.saved": "आपके शेड्यूल में सेव किया:",
  "schedule.saved_clash":
    "सेव किया। यह आपके शेड्यूल में पहले से रखे किसी काम के समय से टकराता है; किसी एक को बदलना हो तो ग्राहक को फ़ोन करें:",
  "schedule.list": "आपके शेड्यूल में:",
  "schedule.empty": "आपके शेड्यूल में कुछ नहीं है। बुकिंग जोड़ने के लिए बोलें: कल 2 से 3 बजे की बुकिंग सेव करो।",
  "schedule.free_day": "उस दिन कोई बुकिंग नहीं है।",
  "schedule.cancelled": "शेड्यूल से हटा दिया:",
  "schedule.none_to_cancel": "उस समय कोई बुकिंग नहीं मिली। सब देखने के लिए पूछें: मेरे शेड्यूल में क्या है?",
  "schedule.which": "एक से ज़्यादा बुकिंग मिलीं। उसका समय भी बताएँ:",
  "schedule.when": "{day}, {start} – {end}",
  "schedule.today": "आज",
  "schedule.tomorrow": "कल",
  "schedule.job": "GigSync का काम: {when}",
  "schedule.title": "आपकी बुकिंग",
  "schedule.hint": "जो बुकिंग आपने 'बात करें' में अपने एजेंट को बताईं। इन समयों पर एजेंट कोई काम तय नहीं करेगा।",
  "schedule.delete": "हटाएँ",
  "schedule.delete_named": "{when} हटाएँ",
  "schedule.soon": "{minutes} मिनट में शुरू",
  "schedule.remind_title": "बुकिंग {time} पर",
  "schedule.remind_body": "{minutes} मिनट में शुरू होगी।",
};
