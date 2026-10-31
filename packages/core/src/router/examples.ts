import { type City, Trade } from "@gigsync/protocol";
import type { PilotArea } from "../estimate/areas.js";
import type { Field } from "../interview/lexicon.js";
import { ChatIntent } from "./intent.js";

/**
 * Labelled sayings per chat intent, in the languages owners use: what the model router shows as examples (ADR 0040)
 * and what the meaning router matches against (ADR 0042). One list, so the two readers never disagree about what an
 * intent sounds like. Adding a phrasing here teaches both; the eval set in vectors/intents stays separate from it.
 */

const I = ChatIntent;
const T = Trade.enum;

/** The slots as the reply spells them: the amount in rupees, as people say it. */
export interface ReplySlots {
  trade?: Trade;
  area?: PilotArea["key"];
  city?: City;
  amount?: number;
  contact?: string;
  field?: Field;
  note?: string;
}
/** One example: what an owner says, and the reply the model should give for it. */
export interface Example {
  said: string;
  reply: ReplySlots & { intent: ChatIntent };
}
const ex = (said: string, intent: ChatIntent, slots: ReplySlots = {}): Example => ({
  said,
  reply: { intent, ...slots },
});

/** Two or three examples per intent, in the languages owners use. */
export const EXAMPLES: Readonly<Record<ChatIntent, readonly Example[]>> = {
  [I.editCard]: [
    ex("change my rate", I.editCard, { field: "rate" }),
    ex("मेरा एरिया बदलो", I.editCard, { field: "area" }),
    ex("ನನ್ನ ಕೆಲಸ ಬದಲಾಯಿಸಿ", I.editCard, { field: "trade" }),
  ],
  [I.helpOffer]: [
    ex("I can show new people around", I.helpOffer),
    ex("नए लोगों की मदद करना चाहती हूँ", I.helpOffer),
    ex("ಹೊಸ ಜನರಿಗೆ ಊರು ತೋರಿಸ್ತೀನಿ", I.helpOffer),
  ],
  [I.helpStop]: [
    ex("I don't want to mentor anymore", I.helpStop),
    ex("madad band karo", I.helpStop),
    ex("ಹೊಸಬರಿಗೆ ಸಹಾಯ ಮಾಡೋದು ನಿಲ್ಲಿಸಿ", I.helpStop),
  ],
  [I.moving]: [
    ex("I'm going to Bangalore for work next month", I.moving, { city: "bengaluru" }),
    ex("मैं नए शहर जा रहा हूँ", I.moving),
  ],
  [I.earnings]: [
    ex("how much did I make this week?", I.earnings),
    ex("is mahine kitna mila", I.earnings),
    ex("ಈ ವಾರ ಎಷ್ಟು ದುಡಿಮೆ ಆಯಿತು", I.earnings),
  ],
  [I.market]: [
    ex("is ₹8,000 fair for a cook?", I.market, { trade: T.cook, amount: 8000 }),
    ex("what do painters take in Jayanagar", I.market, { trade: T.painter, area: "jayanagar" }),
    ex("plumber ka rate kya chal raha hai", I.market, { trade: T.plumber }),
    ex("मेड को 5000 देना ठीक है?", I.market, { trade: T.maid, amount: 5000 }),
    ex("ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಎಷ್ಟು ತೆಗೆದುಕೊಳ್ಳುತ್ತಾರೆ", I.market, { trade: T.electrician }),
    ex("HSR mein maid kitna leti hai", I.market, { trade: T.maid, area: "hsr_layout" }),
    ex("ಮನೆಗೆಲಸದವರಿಗೆ ಎಷ್ಟು ಸಂಬಳ ಕೊಡ್ತಾರೆ", I.market, { trade: T.maid }),
  ],
  [I.guide]: [
    ex("where can I find a cheap room?", I.guide),
    ex("SIM kaise milega", I.guide),
    ex("ಬ್ಯಾಂಕ್ ಖಾತೆ ಹೇಗೆ ತೆರೆಯುವುದು", I.guide),
  ],
  [I.find]: [
    ex("need an electrician tomorrow", I.find, { trade: T.electrician }),
    ex("मुझे खाना बनाने वाली चाहिए", I.find, { trade: T.cook }),
    ex("ನನಗೆ ಪ್ಲಂಬರ್ ಬೇಕು", I.find, { trade: T.plumber }),
  ],
  [I.remember]: [
    ex("remember Kabir pays on the 5th", I.remember, { note: "Kabir pays on the 5th" }),
    ex("याद रखना: रविवार छुट्टी है", I.remember, { note: "रविवार छुट्टी है" }),
  ],
  [I.askSelf]: [
    ex("what did I write about the third floor client?", I.askSelf),
    ex("मैंने किराये के बारे में क्या लिखा था", I.askSelf),
  ],
  [I.askContact]: [
    ex("is Meera free on Friday?", I.askContact, { contact: "Meera" }),
    ex("Raju kahan hai", I.askContact, { contact: "Raju" }),
  ],
  [I.setRule]: [ex("let Meera see where I am", I.setRule, { contact: "Meera" })],
  [I.chat]: [
    ex("hello", I.chat),
    ex("धन्यवाद", I.chat),
    ex("ಒಂದು ಜೋಕ್ ಹೇಳು", I.chat),
    ex("my brother is shifting to Bangalore", I.chat),
    ex("I painted three flats this week", I.chat),
    ex("ಇವತ್ತು ಮಳೆ ಜಾಸ್ತಿ", I.chat),
  ],
};
