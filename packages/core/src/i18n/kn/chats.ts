import type { chats as en } from "../en/chats.js";

/** Kannada: Talk's chats: the list of past chats, a new chat, and deleting one. */
export const chats: Readonly<Record<keyof typeof en, string>> = {
  "chats.open": "ಚಾಟ್‌ಗಳು",
  "chats.new": "ಹೊಸ ಚಾಟ್",
  "chats.title": "ನಿಮ್ಮ ಚಾಟ್‌ಗಳು",
  "chats.today": "ಇಂದು",
  "chats.yesterday": "ನಿನ್ನೆ",
  "chats.earlier": "ಹಿಂದಿನವು",
  "chats.empty": "ಇನ್ನೂ ಹಳೆಯ ಚಾಟ್‌ಗಳಿಲ್ಲ. ಪ್ರತಿ ಚಾಟ್ ಇಲ್ಲೇ, ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.",
  "chats.kept": "ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತ್ರ. ಇತ್ತೀಚಿನ {count} ಚಾಟ್‌ಗಳು ಉಳಿಯುತ್ತವೆ; ಇಲ್ಲಿ ಬೇರೆ ಯಾರಾದರೂ ಸೈನ್ ಇನ್ ಮಾಡಿದರೆ ಅವರಿಗೆ ಇವು ಯಾವುದೂ ಕಾಣುವುದಿಲ್ಲ.",
  "chats.untitled": "ಹೆಸರಿಲ್ಲದ ಚಾಟ್",
  "chats.card_waiting": "ನಿಮ್ಮ ಕಾರ್ಡ್ ಅಪೂರ್ಣವಾಗಿದೆ",
  "chats.delete": "ಅಳಿಸಿ",
  "chats.delete_label": "ಚಾಟ್ ಅಳಿಸಿ: {title}",
  "chats.delete_confirm": "ಈ ಚಾಟ್ ಅಳಿಸಲೇ? ಇದು ಈ ಫೋನ್‌ನಿಂದ ಶಾಶ್ವತವಾಗಿ ಹೋಗುತ್ತದೆ.",
  "chats.delete_confirm_card": "ಈ ಚಾಟ್ ಅಳಿಸಲೇ? ನಿಮ್ಮ ಅಪೂರ್ಣ ಕಾರ್ಡ್‌ನ ಉತ್ತರಗಳ ಜೊತೆಗೆ ಇದು ಈ ಫೋನ್‌ನಿಂದ ಹೋಗುತ್ತದೆ.",
  "chats.delete_yes": "ಅಳಿಸಿ",
  "chats.keep": "ಬೇಡ",
};
