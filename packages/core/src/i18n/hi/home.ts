import type { home as en } from "../en/home.js";

/** Hindi: Activity: what the agents are doing, its counters and sections, the card's state, and the decisions read aloud. */
export const home: Readonly<Record<keyof typeof en, string>> = {
  // Activity, as collab's: the headline, the four counters and what each says when empty
  "activity.headline": "आपके एजेंट क्या कर रहे हैं",
  "activity.tabs": "आपके काम, कहाँ तक पहुँचे",
  "activity.tab_awaiting": "आपके इंतज़ार में",
  "activity.tab_talks": "बातचीत में",
  "activity.tab_agreed": "तय हुए",
  "activity.tab_closed": "बंद",
  "activity.standing_by": "आपके एजेंट तैयार हैं।",
  "activity.awaiting.one": "{count} फ़ैसला आपका इंतज़ार कर रहा है।",
  "activity.awaiting.other": "{count} फ़ैसले आपका इंतज़ार कर रहे हैं।",
  "activity.talking.one": "आपके एजेंट {count} बातचीत में हैं।",
  "activity.talking.other": "आपके एजेंट {count} बातचीत में हैं।",
  "activity.empty_awaiting": "आपके लिए कुछ रुका नहीं है। फ़ैसला आपका हो, तभी आपके एजेंट पूछते हैं।",
  "activity.empty_talks": "अभी कोई बातचीत नहीं चल रही।",
  "activity.empty_agreed": "अभी कुछ तय नहीं हुआ।",
  "activity.hint_worker":
    "चैट में अपने एजेंट को अपने काम के बारे में बताइए: “मैं घर पेंट करता हूँ, ₹800 रोज़”। घर वालों की रिक्वेस्ट यहाँ दिखेंगी।",
  "activity.hint_household": "चैट में कुछ माँगिए: “शनिवार को पेंटर चाहिए”। आपके एजेंटों का काम यहाँ दिखेगा।",
  "activity.records_line": "पूरे हुए काम रिकॉर्ड में हैं।",
  "activity.records_open": "रिकॉर्ड खोलें",
  // The sections inside Agreed, and the worker's card nudges
  "home.today": "आज के काम",
  "home.upcoming": "आगे के काम",
  "home.other": "दूसरे काम",
  "home.jobs": "आपके काम",
  "home.no_card": "अपना कार्ड बनाइए, ताकि आस-पास के ग्राहक आपको ढूँढ सकें।",
  "home.make_card": "बोलकर कार्ड बनाएँ",
  "home.card_off": "आपका कार्ड बोर्ड से हटा है, इसलिए नए ग्राहक आपको नहीं ढूँढ पाएँगे।",
  "home.details": "पूरी जानकारी",
  "home.say_approve": "नई रिक्वेस्ट: {name} को {trade} चाहिए। देखकर फ़ैसला कीजिए।",
  "home.say_answer": "{name} के एजेंट के आपसे कुछ सवाल हैं।",
  "home.say_sign": "{name} {price} पर राज़ी हैं। क्या आप दस्तख़त करना चाहते हैं?",
  "home.say_paid": "{name} कहते हैं कि उन्होंने {price} भेज दिए। क्या पैसे आपको मिल गए?",
};
