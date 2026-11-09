import type { group as en } from "../en/group.js";

/** काम के प्रकारों के समूह (ADR 0061)। */
export const group: Readonly<Record<keyof typeof en, string>> = {
  "group.house_help": "घर का काम",
  "group.home_repairs": "घर की मरम्मत",
  "group.appliances": "घरेलू उपकरण",
  "group.electronics": "इलेक्ट्रॉनिक्स",
  "group.cleaning": "सफ़ाई",
  "group.care": "देखभाल",
  "group.personal": "ब्यूटी और सिलाई",
  "group.vehicles": "गाड़ियाँ",
  "group.outdoor": "बाहर का काम और सामान ढुलाई",
  "group.teaching": "पढ़ाई और सिखाना",
  "group.events": "कार्यक्रम",
  "need.pick_group": "किस तरह का काम? एक समूह चुनें।",
  "need.all_groups": "सभी तरह के काम",
  "need.group_others": "{group} में और:",
  "iv.ask.also": "क्या आप इनमें से कोई काम भी करते हैं? हर एक पर टैप करें, फिर ‘हो गया’ दबाएँ।",
  "card.all_work": "सभी तरह के काम दिखाएँ",
};
