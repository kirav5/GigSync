import type { talk as en } from "../en/talk.js";

/** Hindi: the story of a job as the two agents told it. */
export const talk: Readonly<Record<keyof typeof en, string>> = {
  "talk.title": "एजेंट की बातचीत",
  "talk.request_mine": "आपके एजेंट ने आपकी रिक्वेस्ट {name} को भेजी।",
  "talk.request_theirs": "{name} के एजेंट ने आपके एजेंट को रिक्वेस्ट भेजी।",
  "talk.asked_mine": "आपके एजेंट ने पूछा:",
  "talk.asked_theirs": "{name} के एजेंट ने पूछा:",
  "talk.answered_mine": "आपने जवाब दिया:",
  "talk.answered_theirs": "{name} ने जवाब दिया:",
  "talk.offer_mine": "आपके एजेंट ने {price} कहा।",
  "talk.offer_theirs": "{name} के एजेंट ने {price} कहा।",
  "talk.agreed": "दोनों एजेंट {price} पर राज़ी हुए।",
  "talk.signed_mine": "आपने दस्तख़त किए।",
  "talk.signed_theirs": "{name} ने दस्तख़त किए।",
  "talk.contacts": "दोनों के दस्तख़त हो गए, इसलिए आपकी संपर्क जानकारी एक-दूसरे को भेजी गई।",
  "talk.ended": "बातचीत ख़त्म हुई: {reason}",
  "talk.private_provider": "आपका सबसे कम दाम कभी भेजा नहीं गया। वह इसी फ़ोन पर रहा।",
  "talk.private_requester": "आपका बजट कभी भेजा नहीं गया। वह इसी फ़ोन पर रहा।",
};
