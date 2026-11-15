import type { memory as en } from "../en/memory.js";

/** Hindi: what the agent remembers from past jobs, what the agent says using it, and its setting. */
export const memory: Readonly<Record<keyof typeof en, string>> = {
  "memory.title": "मेरे सहायक को क्या याद है",
  "memory.about":
    "सिर्फ़ इसी फ़ोन पर रहता है, ताकि आपका सहायक दोबारा न पूछे। साइन आउट करने पर भी रहता है; इस फ़ोन पर साइन इन करने वाला कोई और इसे नहीं देखता।",
  "memory.empty": "अभी कुछ नहीं। जिस काम पर आप दोनों ने साइन किया, उससे सहायक ने जो सीखा वह यहाँ दिखेगा।",
  "memory.area": "आपका इलाका",
  "memory.unnamed": "जिनके साथ आपने काम किया",
  "memory.jobs.one": "साथ में {count} काम",
  "memory.jobs.other": "साथ में {count} काम",
  "memory.last_on": "पिछला काम {date}",
  "memory.last_price": "पिछली तय कीमत {price}",
  "memory.they_said": "उन्होंने बताया",
  "memory.asked": "{trade} के कामों में पूछा गया",
  "memory.forget": "भूल जाएँ",
  "memory.show.one": "याद रखी बातें देखें ({count})",
  "memory.show.other": "याद रखी बातें देखें ({count})",
  "memory.forget_all": "सब भूल जाएँ",
  "memory.offer_detail": "पिछले काम से, {detail}: {value}। यही रखें?",
  "memory.offer_detail_old": "एक साल पहले यह पता था, {detail}: {value}। क्या अब भी सही है?",
  "memory.filled_detail": "मैंने {detail}: {value} रखा है, पिछले काम से।",
  "memory.offer_area": "पिछले काम से, आपका इलाका: {area}। यही रखें?",
  "memory.offer_area_old": "एक साल पहले आपका इलाका {area} था। क्या अब भी सही है?",
  "memory.filled_area": "मैंने आपका इलाका {area} रखा है, पिछले काम से।",
  "memory.use": "हाँ, यही रखें",
  "memory.change": "बदलें",
  "memory.change_detail": "{detail} बदलें",
  "memory.change_area": "इलाका बदलें",
  "memory.answer_label": "जब मेरे सहायक को पिछले कामों से कोई जवाब पता हो",
  "memory.answer_ask": "पहले मुझसे पूछें",
  "memory.answer_auto": "मेरी ओर से जवाब दें",
};
