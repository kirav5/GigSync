import type { progress as en } from "../en/progress.js";

/** Hindi: a signed job's progress line, the actions on a job restored from the record, and job alerts. */
export const progress: Readonly<Record<keyof typeof en, string>> = {
  "progress.title": "काम की प्रगति",
  "progress.agreed": "तय हुआ",
  "progress.on_my_way": "रास्ते में",
  "progress.started": "शुरू हुआ",
  "progress.done": "हो गया",
  "progress.paid": "भुगतान हुआ",
  "progress.closed": "बंद",
  "progress.cancelled": "रद्द",
  "progress.you": "आप",
  "restored.work_done": "काम हो गया",
  "restored.cancel": "यह काम रद्द करें",
  "restored.why": "यह काम आपके GigSync रिकॉर्ड से वापस आया है, इसलिए बदलाव रिकॉर्ड से होकर एक मिनट में {name} तक पहुँचेगा।",
  "restored.cancel_sure": "यह काम आप दोनों के लिए रद्द करें?",
  "restored.cancel_yes": "हाँ, रद्द करें",
  "restored.keep": "रहने दें",
  "alerts.title": "काम की सूचनाएँ",
  "alerts.about":
    "जब काम आगे बढ़े तब इस फ़ोन पर सूचना: नई रिक्वेस्ट, साइन करने वाला सौदा, वर्कर रास्ते में, काम पूरा, भुगतान या रद्द। इसमें कही गई बात कभी नहीं दिखती।",
  "alerts.on": "चालू: सूचनाएँ इस फ़ोन पर आती हैं।",
  "alerts.turn_on": "सूचनाएँ चालू करें",
  "alerts.turn_off": "बंद करें",
  "alerts.blocked": "इस ब्राउज़र में GigSync की सूचनाएँ बंद हैं। ब्राउज़र की इस साइट वाली सेटिंग में उन्हें चालू करें, फिर यहाँ वापस आएँ।",
  "alerts.install": "iPhone पर सूचनाएँ होम स्क्रीन वाले GigSync ऐप में आती हैं। Share से उसे जोड़ें, वहीं से खोलें, फिर सूचनाएँ चालू करें।",
  "alerts.unsupported": "यह ब्राउज़र GigSync की सूचनाएँ नहीं दिखा सकता।",
  "alerts.unavailable": "GigSync पर अभी सूचनाएँ शुरू नहीं हुई हैं। बाद में फिर कोशिश करें।",
};
