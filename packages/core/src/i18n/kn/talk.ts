import type { talk as en } from "../en/talk.js";

/** Kannada: the story of a job as the two agents told it. */
export const talk: Readonly<Record<keyof typeof en, string>> = {
  "talk.title": "ಏಜೆಂಟ್ ಮಾತುಕತೆ",
  "talk.request_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ ನಿಮ್ಮ ರಿಕ್ವೆಸ್ಟ್ ಅನ್ನು {name} ಅವರಿಗೆ ಕಳುಹಿಸಿತು.",
  "talk.request_theirs": "{name} ಅವರ ಏಜೆಂಟ್ ನಿಮ್ಮ ಏಜೆಂಟ್‌ಗೆ ರಿಕ್ವೆಸ್ಟ್ ಕಳುಹಿಸಿತು.",
  "talk.asked_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ ಕೇಳಿತು:",
  "talk.asked_theirs": "{name} ಅವರ ಏಜೆಂಟ್ ಕೇಳಿತು:",
  "talk.answered_mine": "ನೀವು ಉತ್ತರಿಸಿದಿರಿ:",
  "talk.answered_theirs": "{name} ಅವರು ಉತ್ತರಿಸಿದರು:",
  "talk.offer_mine": "ನಿಮ್ಮ ಏಜೆಂಟ್ {price} ಹೇಳಿತು.",
  "talk.offer_theirs": "{name} ಅವರ ಏಜೆಂಟ್ {price} ಹೇಳಿತು.",
  "talk.agreed": "ಎರಡೂ ಏಜೆಂಟ್‌ಗಳು {price} ಮೊತ್ತಕ್ಕೆ ಒಪ್ಪಿದವು.",
  "talk.signed_mine": "ನೀವು ಸಹಿ ಮಾಡಿದಿರಿ.",
  "talk.signed_theirs": "{name} ಅವರು ಸಹಿ ಮಾಡಿದರು.",
  "talk.contacts": "ಇಬ್ಬರೂ ಸಹಿ ಮಾಡಿದ್ದರಿಂದ ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿವರಗಳನ್ನು ಒಬ್ಬರಿಗೊಬ್ಬರು ಹಂಚಲಾಯಿತು.",
  "talk.ended": "ಮಾತುಕತೆ ಮುಗಿಯಿತು: {reason}",
  "talk.private_provider": "ನಿಮ್ಮ ಕನಿಷ್ಠ ದರವನ್ನು ಎಂದೂ ಕಳುಹಿಸಲಿಲ್ಲ. ಅದು ಈ ಫೋನ್‌ನಲ್ಲೇ ಉಳಿಯಿತು.",
  "talk.private_requester": "ನಿಮ್ಮ ಬಜೆಟ್ ಅನ್ನು ಎಂದೂ ಕಳುಹಿಸಲಿಲ್ಲ. ಅದು ಈ ಫೋನ್‌ನಲ್ಲೇ ಉಳಿಯಿತು.",
};
