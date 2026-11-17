import type { chats as en } from "../en/chats.js";

/** Hindi: Talk's and Find's chats: the list of past chats, a new chat, and deleting one. */
export const chats: Readonly<Record<keyof typeof en, string>> = {
  "chats.new": "नई चैट",
  "chats.title": "आपकी चैट",
  "chats.today": "आज",
  "chats.yesterday": "कल",
  "chats.earlier": "पहले की",
  "chats.empty": "अभी कोई पुरानी चैट नहीं। हर चैट यहीं, इस फ़ोन पर रखी जाती है।",
  "chats.kept": "सिर्फ़ इस फ़ोन पर। सबसे नई {count} चैट रखी जाती हैं; यहाँ कोई और साइन इन करे तो उसे इनमें से कुछ नहीं दिखता।",
  "chats.untitled": "बिना नाम की चैट",
  "chats.card_waiting": "आपका कार्ड अधूरा है",
  "chats.delete": "मिटाएँ",
  "chats.delete_label": "चैट मिटाएँ: {title}",
  "chats.delete_title": '"{title}" मिटाएँ?',
  "chats.delete_confirm": "चैट इस फ़ोन से हमेशा के लिए हट जाएगी।",
  "chats.delete_confirm_card": "चैट और उसके अधूरे कार्ड के जवाब इस फ़ोन से हट जाएँगे।",
  "chats.delete_yes": "मिटाएँ",
  "chats.keep": "रहने दें",
  "chats.need_unsent": "अभी कामगारों को नहीं भेजा",
  "chats.delete_confirm_sent": "चैट इस फ़ोन से हट जाएगी; इसका काम 'मेरे काम' में रहेगा।",
  "chats.new_need": "कुछ और माँगें",
};
