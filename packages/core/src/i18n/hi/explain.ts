import type { explain as en } from "../en/explain.js";

/** Hindi: why an offer is what it is, one sentence per fact. */
export const explain: Readonly<Record<keyof typeof en, string>> = {
  "explain.opened_mine": "आपके एजेंट ने {price} से शुरू किया।",
  "explain.opened_theirs": "{name} ने {price} से शुरू किया।",
  "explain.down_mine": "आपका एजेंट {delta} कम करके {price} पर आया।",
  "explain.down_theirs": "{name} {delta} कम करके {price} पर आए।",
  "explain.up_mine": "आपका एजेंट {delta} बढ़ाकर {price} पर आया।",
  "explain.up_theirs": "{name} {delta} बढ़ाकर {price} पर आए।",
  "explain.held_mine": "आपके एजेंट ने दाम {price} ही रखा और शर्तें बदलीं।",
  "explain.held_theirs": "{name} ने दाम {price} ही रखा और शर्तें बदलीं।",
  "explain.terms_mine": "आपके एजेंट ने कहा: {terms}।",
  "explain.terms_theirs": "{name} ने कहा: {terms}।",
  "explain.usual.one": "आम रेट {typical} है ({low}–{high}, {count} स्रोत से)।",
  "explain.usual.other": "आम रेट {typical} है ({low}–{high}, {count} स्रोतों से)।",
  "explain.usual_jobs.one": "आम रेट {typical} है ({low}–{high}, GigSync के {count} काम से)।",
  "explain.usual_jobs.other": "आम रेट {typical} है ({low}–{high}, GigSync के {count} कामों से)।",
  "explain.usual_range": "आम रेट {low}–{high} है।",
  "explain.limit_within": "यह आपकी सीमा {limit} के अंदर है।",
  "explain.limit_outside": "यह आपकी सीमा {limit} से {gap} बाहर है।",
  "explain.label": "यह ऑफ़र क्यों",
};
