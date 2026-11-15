import type { findflow as en } from "../en/findflow.js";

/** Hindi: the household's Find: the privacy card, address cards, the budget band, worker cards and a card opened by QR. */
export const findflow: Readonly<Record<keyof typeof en, string>> = {
  "find.door_check": "क्या पिन आपके दरवाज़े पर है? नक्शा खिसकाकर उसे दरवाज़े पर लाएँ।",
  "find.door_saved": "पिन आपके दरवाज़े पर सहेज लिया। दोनों के हस्ताक्षर के बाद ही यह काम करने वाले को मिलता है।",
  "find.say_it": "मैं ख़ुद बताऊँ",
  "find.band_caption": "इस काम का आम दाम इसी दायरे में होता है। निशान सबसे आम दाम है।",
  "find.ask_note": "उनके एजेंट आपके एजेंट से बात करेंगे। न नाम भेजा जाता है, न नंबर।",
  "find.qr_intro": "आपने {name} का कार्ड स्कैन किया। उनके एजेंट को बताइए कि क्या काम चाहिए।",
  "addr.door_title": "पिन अपने दरवाज़े पर लगाइए।",
  "addr.door_hint": "नक्शा तब तक खिसकाइए जब तक पिन आपके गेट पर न आ जाए।",
  "addr.door_field": "फ़्लैट, मंज़िल या पास की पहचान",
  "addr.door_save": "यही मेरा दरवाज़ा है",
  "addr.door_note":
    "दोनों के हस्ताक्षर तक काम करने वालों को सिर्फ़ इलाका दिखता है। सही पिन उसी काम के लिए भेजा जाता है, फिर हटा दिया जाता है।",
  "addr.more": "और जानकारी",
};
