import type { shell as en } from "../en/shell.js";

/** Hindi: the tab bar, the back button, Profile, and Find's When chips. */
export const shell: Readonly<Record<keyof typeof en, string>> = {
  "nav.talk": "बात करें",
  "nav.passbook": "पासबुक",
  "nav.profile": "प्रोफ़ाइल",
  "a11y.tabs": "मुख्य हिस्से",
  "a11y.back": "वापस",
  "profile.card_off": "आपका कार्ड अभी बोर्ड पर नहीं है",
  "profile.talk_card": "बोलकर बदलें",
  "profile.agent": "आपका एजेंट",
  "profile.more": "और सेटिंग्स",
  "profile.language": "भाषा",
  "when.today": "आज",
  "when.tomorrow": "कल",
  "when.pick": "तारीख़ चुनें",
  "when.daily": "रोज़",
  "when.time": "समय (अगर ज़रूरी हो)",
  "perm.mic_why": "आपकी बात सुनने के लिए GigSync को माइक्रोफ़ोन चाहिए। अब आपका फ़ोन इजाज़त माँगेगा।",
  "perm.continue": "आगे बढ़ें",
  "perm.not_now": "अभी नहीं",
};
