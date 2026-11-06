import type { skill as en } from "../en/skill.js";

/** सूची से बाहर का काम (ADR 0047): कामगार अपने शब्दों में काम लिखते हैं, परिवार वही काम माँगते हैं। */
export const skill: Readonly<Record<keyof typeof en, string>> = {
  "trade.other": "दूसरा काम",
  "question.job": "काम ठीक-ठीक क्या है?",
  "detail.job": "काम",
  "question.duration": "लगभग कितना समय लगेगा?",
  "detail.duration": "कितना समय लगेगा",
  "skill.err.length": "काम का नाम 2 से 40 अक्षरों में लिखें।",
  "skill.err.words": "काम का नाम कुछ शब्दों में लिखें, जैसे “दर्ज़ी” या “बाग़बानी”।",
  "skill.err.characters": "काम के नाम में सिर्फ़ अक्षर लिखें: नंबर, लिंक या संपर्क नहीं।",
  "skill.err.blocked": "यह काम GigSync पर नहीं लिखा जा सकता।",
  "skill.err.too_many": "एक कार्ड पर ज़्यादा से ज़्यादा {max} तरह के काम हो सकते हैं।",
  "skill.is_trade": "यह {trade} है: यह सूची में है, अपने दामों के साथ।",
  "card.skill_label": "दूसरा काम, अपने शब्दों में",
  "card.skill_example": "दर्ज़ी",
  "card.skill_add": "जोड़ें",
  "card.skill_remove": "{skill} हटाएँ",
  "iv.skill_kept": "मैं इसे “{skill}” लिखूँगा।",
  "need.skill_found": "आपके पास के कामगार “{skill}” का काम करते हैं।",
  "need.pick_work": "सूची में से चुनें",
  "need.skill_no_rate": "GigSync पर इस काम का अभी कोई चालू दाम नहीं है। बताइए आप कितना देंगे।",
  "need.listed_rates": "आपके पास के वर्कर इस काम के लिए लगभग {low} से {high} बताते हैं ({count} वर्कर)। बताइए, आप कितना देंगे।",
};
