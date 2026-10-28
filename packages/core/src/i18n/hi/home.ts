import type { home as en } from "../en/home.js";

/** Hindi: Today and My jobs: the day's sections, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  "home.title": "आज, {date}",
  "home.decide": "अभी फ़ैसला करें",
  "home.today": "आज के काम",
  "home.empty_today": "आज के लिए कोई काम तय नहीं है।",
  "home.upcoming": "आगे के काम",
  "home.other": "दूसरे काम",
  "home.jobs": "आपके काम",
  "home.talking.one": "आपका एजेंट {count} ग्राहक से बात कर रहा है",
  "home.talking.other": "आपका एजेंट {count} ग्राहकों से बात कर रहा है",
  "home.talking_workers.one": "आपका एजेंट {count} कामगार से बात कर रहा है",
  "home.talking_workers.other": "आपका एजेंट {count} कामगारों से बात कर रहा है",
  "home.earlier": "पहले के काम",
  "home.empty": "अभी कोई काम नहीं। कोई ग्राहक पूछेगा तो यहीं दिखेगा।",
  "home.no_card": "अपना कार्ड बनाइए, ताकि आस-पास के ग्राहक आपको ढूँढ सकें।",
  "home.make_card": "बोलकर कार्ड बनाएँ",
  "home.card_off": "आपका कार्ड बोर्ड से हटा है, इसलिए नए ग्राहक आपको नहीं ढूँढ पाएँगे।",
  "home.details": "पूरी जानकारी",
  "home.passbook_hint": "जो पैसे मिलते हैं, वे आपकी पासबुक में दर्ज होते हैं।",
  "home.say_approve": "नई रिक्वेस्ट: {name} को {trade} चाहिए। देखकर फ़ैसला कीजिए।",
  "home.say_answer": "{name} के एजेंट के आपसे कुछ सवाल हैं।",
  "home.say_sign": "{name} {price} पर राज़ी हैं। क्या आप दस्तख़त करना चाहते हैं?",
  "home.say_paid": "{name} कहते हैं कि उन्होंने {price} भेज दिए। क्या पैसे आपको मिल गए?",
};
