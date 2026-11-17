import type { page as en } from "../en/page.js";

/** Hindi: the pages the menu opens, each on its own: My card, Records, About me, Privacy and Settings. */
export const page: Readonly<Record<keyof typeof en, string>> = {
  // My card
  "page.card_seen": "घर वाले यह देखते हैं",
  "page.card_none": 'आपका कार्ड अभी नहीं बना। "मेरा कार्ड बदलें" से बनाइए, या चैट में अपने सहायक को अपने काम के बारे में बताइए।',
  // Records: completed work, and for a household what it paid
  "page.records_soft_worker": "GigSync पर पूरे किए काम, और उनसे हुई कमाई।",
  "page.records_soft": "GigSync पर आपके लिए हुए काम, और आपने कितना चुकाया।",
  "page.records_empty": "अभी यहाँ कुछ नहीं। आपके लिए किया गया काम पूरा होते ही यहाँ दिखेगा।",
  "page.not_paid": "कोई भुगतान दर्ज नहीं",
  "page.not_completed": "पूरे नहीं हुए · {count}",
  "page.paid": "{price} चुकाए",
  "page.paid_unconfirmed": "{price} चुकाए · अभी पक्का नहीं हुआ",
  // About me
  "page.about_title": "आपका सहायक क्या जानता है।",
  // Privacy
  "page.privacy_title": "कौन क्या देखता है।",
  "page.privacy_soft": "आपका सहायक क्या बताता है, और किसे आपने दूर रखा।",
  // Settings
  "page.settings_title": "आप और आपका सहायक।",
  "page.settings_soft": "वह कैसे मोलभाव करता है, बोलता है, दिखता है और चलता है। इसी फ़ोन पर रहता है।",
};
