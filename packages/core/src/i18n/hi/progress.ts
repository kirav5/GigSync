import type { progress as en } from "../en/progress.js";

/** Hindi: a signed job's progress line, and the actions on a job restored from the record. */
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
};
