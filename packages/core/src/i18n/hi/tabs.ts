import type { tabs as en } from "../en/tabs.js";

/** Hindi: the bottom tabs, the top bar's own words, the profile sheet and Home's greeting. */
export const tabs: Readonly<Record<keyof typeof en, string>> = {
  "shell.tabs": "मुख्य टैब",
  "nav.home": "होम",
  "nav.jobs": "गतिविधि",
  "nav.earnings": "कमाई",
  "nav.payments": "भुगतान",
  "tabs.namaste": "नमस्ते, {name}",
  "tabs.alerts": "सूचनाएँ",
  "tabs.alerts_none": "अभी आपके लिए कुछ नहीं रुका है।",
  "profile.open": "आपकी प्रोफ़ाइल",
  "profile.title": "प्रोफ़ाइल",
  "profile.done": "हो गया",
  "profile.verified": "✓ फ़ोन नंबर जाँचा गया",
  "profile.group_card": "आपका कार्ड",
  "profile.group_home": "आपका घर",
  "profile.group_help": "सूचनाएँ और मदद",
  "profile.group_prefs": "पसंद",
  "profile.my_qr": "मेरा QR",
  "profile.my_qr_sub": "कामगार इसे स्कैन करके आपके यहाँ काम की पेशकश कर सकते हैं",
  "home.ask_household": "आपको किस काम में मदद चाहिए?",
  "home.suggest_jobs": "आज के काम दिखाएँ",
  "home.suggest_verify": "पहचान जँचवाएँ",
  "home.suggest_cook": "रोज़ खाना बनाने के लिए कुक",
  "home.suggest_clean": "घर के काम के लिए कोई",
  "home.my_places": "मेरी जगहें",
};
