import type { shell as en } from "../en/shell.js";

/** Hindi: the app's frame (the menu, its rows, the top bar), the screens the menu opens, and Find's When chips. */
export const shell: Readonly<Record<keyof typeof en, string>> = {
  "nav.talk": "बात करें",
  "nav.activity": "गतिविधि",
  "nav.records": "रिकॉर्ड",
  "nav.about": "मेरे बारे में",
  "nav.privacy": "निजता",
  "nav.settings": "सेटिंग्स",
  "a11y.back": "वापस",
  "shell.menu": "मेन्यू",
  "shell.drawer": "GigSync मेन्यू",
  "shell.need_you.one": "{count} काम आपका इंतज़ार कर रहा है",
  "shell.need_you.other": "{count} काम आपका इंतज़ार कर रहे हैं",
  "shell.model_about": "आपका एजेंट किससे चलता है। सेटिंग्स के लिए दबाएँ।",
  "shell.model_device": "इसी फ़ोन पर",
  "shell.model_server": "GigSync का मॉडल",
  "shell.model_ollama": "Ollama मॉडल · {name}",
  "shell.edit_card": "मेरा कार्ड बदलें",
  "profile.card_off": "आपका कार्ड अभी बोर्ड पर नहीं है",
  "profile.language": "भाषा",
  "when.today": "आज",
  "when.tomorrow": "कल",
  "when.pick": "तारीख़ चुनें",
  "when.daily": "रोज़",
  "perm.not_now": "अभी नहीं",
};
