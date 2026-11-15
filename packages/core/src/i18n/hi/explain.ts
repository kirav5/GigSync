import type { explain as en } from "../en/explain.js";

/** Hindi: why an offer is what it is, one sentence per fact. */
export const explain: Readonly<Record<keyof typeof en, string>> = {
  "explain.opened_mine": "आपके सहायक ने {price} से शुरू किया।",
  "explain.opened_theirs": "{name} ने {price} से शुरू किया।",
  "explain.down_mine": "आपका सहायक {delta} कम करके {price} पर आया।",
  "explain.down_theirs": "{name} {delta} कम करके {price} पर आए।",
  "explain.up_mine": "आपका सहायक {delta} बढ़ाकर {price} पर आया।",
  "explain.up_theirs": "{name} {delta} बढ़ाकर {price} पर आए।",
  "explain.held_mine": "आपके सहायक ने दाम {price} ही रखा।",
  "explain.held_theirs": "{name} ने दाम {price} ही रखा।",
  "explain.terms_mine": "आपके सहायक ने कहा: {terms}।",
  "explain.terms_theirs": "{name} ने कहा: {terms}।",
  "explain.usual_jobs.one": "आम रेट {typical} है ({low}–{high}, GigSync के {count} काम से)।",
  "explain.usual_jobs.other": "आम रेट {typical} है ({low}–{high}, GigSync के {count} कामों से)।",
  "explain.usual_range": "आम रेट {low}–{high} है।",
  "explain.limit.provider.above": "यह आपके सबसे कम दाम {limit} से {gap} ज़्यादा है।",
  "explain.limit.provider.below": "यह आपके सबसे कम दाम {limit} से {gap} कम है।",
  "explain.limit.provider.at": "यह ठीक आपका सबसे कम दाम {limit} है।",
  "explain.limit.requester.above": "यह आपके बजट {limit} से {gap} ज़्यादा है।",
  "explain.limit.requester.below": "यह आपके बजट {limit} से {gap} कम है।",
  "explain.limit.requester.at": "यह ठीक आपका बजट {limit} है।",
  "explain.label": "यह ऑफ़र क्यों",
};
