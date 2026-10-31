import type { page as en } from "../en/page.js";

/** Hindi: the pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page: Readonly<Record<keyof typeof en, string>> = {
  // My card
  "page.card_soft_worker": "इसे भेजिए — कोई भी आपसे काम के लिए पूछ सकता है।",
  "page.card_seen": "घर वाले यह देखते हैं",
  "page.card_none": 'आपका कार्ड अभी नहीं बना। "मेरा कार्ड बदलें" से बनाइए, या चैट में अपने एजेंट को अपने काम के बारे में बताइए।',
  "page.card_soft": "इसे भेजिए — कामगार आपके लिए काम करने की पेशकश कर सकते हैं।",
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "GigSync पर पूरे किए काम, और उनसे हुई कमाई।",
  "page.records_soft": "GigSync पर आपके लिए हुए काम, और आपने कितना चुकाया।",
  "page.records_total": "कुल चुकाया",
  "page.records_empty": "अभी कोई काम पूरा नहीं हुआ। काम पूरा होते ही यहाँ दिखेगा।",
  "page.not_paid": "कोई भुगतान दर्ज नहीं",
  "page.not_completed": "पूरे नहीं हुए · {count}",
  "page.paid": "{price} चुकाए",
  "page.paid_unconfirmed": "{price} चुकाए · अभी पक्का नहीं हुआ",
  // About me
  "page.about_title": "आपका एजेंट क्या जानता है।",
  // Privacy
  "page.privacy_title": "कौन क्या देखता है।",
  "page.privacy_soft": "आपका एजेंट क्या बताता है, और किसे आपने दूर रखा।",
  "page.blocked": "जिन्हें आपने ब्लॉक किया",
  "page.blocked_about": "इस फ़ोन पर हर जगह छिपे रहते हैं और आपसे फिर कभी नहीं मिलाए जाते। ब्लॉक यहाँ से हटाया नहीं जा सकता।",
  "page.blocked_none": "आपने किसी को ब्लॉक नहीं किया है।",
  "page.blocked_unnamed": "जिनके साथ आपने कभी काम नहीं किया",
  "page.blocked_on": "{date} को ब्लॉक किया",
  // Settings
  "page.settings_title": "आप और आपका एजेंट।",
  "page.settings_soft": "वह कैसे मोलभाव करता है, बोलता है, दिखता है और चलता है। इसी फ़ोन पर रहता है।",
};
