import type { home as en } from "../en/home.js";

/** Hindi: The Jobs tab: its three sections and what each says when empty, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  // The Jobs tab: its heading, its three sections (needs you, agents talking, agreed) and the way to closed jobs
  "activity.headline": "आपके काम",
  "activity.tab_awaiting": "आपका फ़ैसला चाहिए",
  "activity.tab_talks": "सहायकों की बातचीत",
  "activity.tab_agreed": "तय हुए",
  "activity.tab_closed": "बंद काम",
  "activity.talking.one": "आपका सहायक {count} घर से बात कर रहा है",
  "activity.talking.other": "आपका सहायक {count} घरों से बात कर रहा है",
  "activity.hint_worker": "घरों के अनुरोध यहाँ दिखेंगे।",
  "activity.hint_household": "आपके काम यहाँ दिखेंगे।",
  // The worker's Agreed by day, and their card nudges on Home
  "home.no_card": "अपना कार्ड बनाइए, ताकि आस-पास के ग्राहक आपको ढूँढ सकें।",
  "home.make_card": "बोलकर कार्ड बनाएँ",
  "home.card_off": "आपका कार्ड बोर्ड से हटा है, इसलिए नए ग्राहक आपको नहीं ढूँढ पाएँगे।",
  "home.details": "पूरी जानकारी",
  "home.say_approve": "नई रिक्वेस्ट: {name} को {trade} चाहिए। देखकर फ़ैसला कीजिए।",
  "home.say_answer": "{name} के सहायक के आपसे कुछ सवाल हैं।",
  "home.say_sign": "{name} {price} पर राज़ी हैं। क्या आप दस्तख़त करना चाहते हैं?",
  "home.say_paid": "{name} कहते हैं कि उन्होंने {price} भेज दिए। क्या पैसे आपको मिल गए?",
};
