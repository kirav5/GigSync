import { City, Trade } from "@gigsync/protocol";
import type { PilotArea } from "../estimate/areas.js";
import type { Field } from "../interview/lexicon.js";
import { ChatIntent } from "./intent.js";

/**
 * Labelled sayings per chat intent, in the five ways owners write: what the model router shows as examples (ADR 0040)
 * and what the meaning router matches against (ADR 0042). One list, so the two readers never disagree about what an
 * intent sounds like. The prompt shows only those in the script the message is written in (a Kannada-script message
 * sees Kannada, a Kannada owner typing in Latin letters sees Kanglish), which keeps it short; the meaning router uses
 * them all. One per script for the plain
 * intents; more, in contrasting pairs, where models confuse intents: a trade word in a request, a note and a question
 * about notes, not only in a price question; "don't tell" as well as "let". None is an eval case (vectors/intents):
 * the eval must test what the readers were not shown.
 */

const I = ChatIntent;
const T = Trade.enum;
const BENGALURU = City.enum.bengaluru;
/** Contacts the examples name; never an owner's, so the model learns the shape, not the people. */
const RAVI = "Ravi";
const SEEMA = "Seema";
const SUNIL = "Sunil";
const MEERA = "Meera";
const RAJU = "Raju";
const MANJU = "Manju";

/** The ways owners write: a language, and Hindi and Kannada also in Latin letters. */
export const Script = { en: "en", hi: "hi", hinglish: "hinglish", kn: "kn", kanglish: "kanglish" } as const;
export type Script = (typeof Script)[keyof typeof Script];
const S = Script;

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

/** One example: what an owner says, how they write it, and the reply the model should give. */
export interface Example {
  script: Script;
  said: string;
  reply: ReplySlots & { intent: ChatIntent };
}
const ex = (script: Script, said: string, intent: ChatIntent, slots: ReplySlots = {}): Example => ({
  script,
  said,
  reply: { intent, ...slots },
});

export const EXAMPLES: Readonly<Record<ChatIntent, readonly Example[]>> = {
  [I.editCard]: [
    ex(S.en, "update my daily rate on the card", I.editCard, { field: "rate" }),
    ex(S.hi, "मेरा एरिया बदलो", I.editCard, { field: "area" }),
    ex(S.hinglish, "mera kaam badalna hai card pe", I.editCard, { field: "trade" }),
    ex(S.kn, "ನನ್ನ ಕೆಲಸ ಬದಲಾಯಿಸಿ", I.editCard, { field: "trade" }),
    ex(S.kanglish, "nanna area badlaayisi", I.editCard, { field: "area" }),
    ex(S.hinglish, "mera rate 900 kar do", I.editCard, { field: "rate" }),
    ex(S.kn, "ನನ್ನ ಮಿನಿಮಮ್ ಚಾರ್ಜ್ 400 ಮಾಡಿ", I.editCard, { field: "min" }),
  ],
  [I.helpOffer]: [
    ex(S.en, "I can show new people around", I.helpOffer),
    ex(S.hi, "शहर में नए आए लोगों को रास्ता दिखा दूँगी", I.helpOffer),
    ex(S.hinglish, "naye logon ko shehar samjha sakta hoon", I.helpOffer),
    ex(S.kn, "ಹೊಸ ಜನರಿಗೆ ಊರು ತೋರಿಸ್ತೀನಿ", I.helpOffer),
    ex(S.kanglish, "hosabrige sahaya maadtini", I.helpOffer),
  ],
  [I.helpStop]: [
    ex(S.en, "I don't want to mentor anymore", I.helpStop),
    ex(S.hi, "अब नए लोगों की मदद नहीं करनी", I.helpStop),
    ex(S.hinglish, "madad band karo", I.helpStop),
    ex(S.kn, "ಹೊಸಬರಿಗೆ ಸಹಾಯ ಮಾಡೋದು ನಿಲ್ಲಿಸಿ", I.helpStop),
    ex(S.kanglish, "hosabrige sahaya maadodu nillisi", I.helpStop),
    ex(S.hi, "नए लोगों को सिखाने का काम अब बंद करना है", I.helpStop),
    ex(S.kanglish, "naanu mentor aagi irolla", I.helpStop),
  ],
  [I.moving]: [
    ex(S.en, "I'm going to Bangalore for work next month", I.moving, { city: BENGALURU }),
    ex(S.hi, "मैं नए शहर जा रहा हूँ", I.moving),
    ex(S.hinglish, "kaam ke liye Bangalore aana hai agle saal", I.moving, { city: BENGALURU }),
    ex(S.kn, "ಮುಂದಿನ ತಿಂಗಳು ಕೆಲಸಕ್ಕಾಗಿ ಮೈಸೂರಿಗೆ ಶಿಫ್ಟ್ ಆಗ್ತೀನಿ", I.moving),
    ex(S.kanglish, "kelsakke Bengaluru ge bartini", I.moving, { city: BENGALURU }),
  ],
  [I.earnings]: [
    ex(S.en, "how much have I been paid so far this month?", I.earnings),
    ex(S.hi, "इस हफ़्ते कितना पैसा मिला", I.earnings),
    ex(S.hinglish, "is mahine kitna mila", I.earnings),
    ex(S.kn, "ಈ ವಾರ ಎಷ್ಟು ದುಡಿಮೆ ಆಯಿತು", I.earnings),
    ex(S.kanglish, "nange ivattinavarege eshtu sambla bandide", I.earnings),
  ],
  [I.schedule]: [
    ex(S.en, "put a booking on Friday from 10 to 12 at the Iyer flat", I.schedule),
    ex(S.en, "what's on my schedule for tomorrow?", I.schedule),
    ex(S.hi, "परसों सुबह 9 से 11 बजे की बुकिंग रख लो", I.schedule),
    ex(S.hinglish, "kal shaam 5 se 7 Mehta ji ke yahan kaam hai, schedule mein daal do", I.schedule),
    ex(S.hinglish, "kal wali booking cancel kar do", I.schedule),
    ex(S.kn, "ಶುಕ್ರವಾರ 3 ರಿಂದ 5 ಗಂಟೆ ಬುಕಿಂಗ್ ಇದೆ, ಉಳಿಸಿ", I.schedule),
    ex(S.kanglish, "naale beligge 8 inda 10 booking ide, save maadi", I.schedule),
  ],
  [I.market]: [
    ex(S.en, "is ₹9,500 okay for a full-time driver?", I.market, { trade: T.driver, amount: 9500 }),
    ex(S.en, "what do painters take in Jayanagar", I.market, { trade: T.painter, area: "jayanagar" }),
    ex(S.hi, "मेड को 5000 देना ठीक है?", I.market, { trade: T.maid, amount: 5000 }),
    ex(S.hinglish, "plumber ka rate kya chal raha hai", I.market, { trade: T.plumber }),
    ex(S.kn, "ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಎಷ್ಟು ತೆಗೆದುಕೊಳ್ಳುತ್ತಾರೆ", I.market, { trade: T.electrician }),
    ex(S.kanglish, "HSR alli driver ge tingalige eshtu kodtaare", I.market, { trade: T.driver, area: "hsr_layout" }),
  ],
  [I.find]: [
    ex(S.en, "need an electrician tomorrow", I.find, { trade: T.electrician }),
    ex(S.en, "water is dripping under the sink, can someone come", I.find, { trade: T.plumber }),
    ex(S.hi, "मुझे खाना बनाने वाली चाहिए", I.find, { trade: T.cook }),
    ex(S.hinglish, "ghar ki safai ke liye koi chahiye kal se", I.find, { trade: T.maid }),
    ex(S.kn, "ನನಗೆ ಪ್ಲಂಬರ್ ಬೇಕು", I.find, { trade: T.plumber }),
    ex(S.kanglish, "bedroom light hogide yaaradru kalsi", I.find, { trade: T.electrician }),
  ],
  [I.remember]: [
    ex(S.en, "remember Kabir pays on the 5th", I.remember, { note: "Kabir pays on the 5th" }),
    ex(S.en, "note that the carpenter is called Imran", I.remember, { note: "the carpenter is called Imran" }),
    ex(S.hi, "याद रखना: रविवार छुट्टी है", I.remember, { note: "रविवार छुट्टी है" }),
    ex(S.hinglish, "likh lo driver ka phone kal milega", I.remember, { note: "driver ka phone kal milega" }),
    ex(S.kn, "ಬರ್ಕೊ: ಶನಿವಾರ ರಜೆ", I.remember, { note: "ಶನಿವಾರ ರಜೆ" }),
    ex(S.kanglish, "note maadko cook ge 5 ne tareeku sambla", I.remember, { note: "cook ge 5 ne tareeku sambla" }),
  ],
  [I.askSelf]: [
    ex(S.en, "what did I write about the third floor client?", I.askSelf),
    ex(S.en, "what did I note about the painter's advance?", I.askSelf),
    ex(S.hi, "किराये वाली बात मैंने नोट में क्या रखी थी", I.askSelf),
    ex(S.hinglish, "maid ki chhutti wali baat note mein kya hai", I.askSelf),
    ex(S.kn, "ಬಾಡಿಗೆ ಬಗ್ಗೆ ನಾನು ಏನು ಬರ್ಕೊಂಡಿದ್ದೆ", I.askSelf),
    ex(S.kanglish, "electrician bagge naanu enu bardidde", I.askSelf),
    ex(S.kn, "ಡ್ರೈವರ್ ಸಂಬಳದ ಬಗ್ಗೆ ಏನು ನೋಟ್ ಮಾಡಿದ್ದೆ", I.askSelf),
    ex(S.hi, "प्लंबर के बारे में मैंने क्या बताया था", I.askSelf),
    ex(S.hinglish, "Sharma ji ke ghar ka gate code kya likha tha maine", I.askSelf),
    ex(S.kanglish, "cook ge yaav dina rajaa antha naanu bardidde", I.askSelf),
  ],
  [I.askContact]: [
    ex(S.en, "is Meera free on Friday?", I.askContact, { contact: MEERA }),
    ex(S.hi, "राजू कहाँ है", I.askContact, { contact: RAJU }),
    ex(S.hinglish, "Raju se pucho kal aayega kya", I.askContact, { contact: RAJU }),
    ex(S.kn, "ಮಂಜು ನಾಳೆ ಬರ್ತಾರಾ ಕೇಳಿ", I.askContact, { contact: MANJU }),
    ex(S.kanglish, "Manju ge keli naale free na", I.askContact, { contact: MANJU }),
    ex(S.en, "ask Raju if he can come at nine tomorrow", I.askContact, { contact: RAJU }),
    ex(S.hi, "सुनील से पूछो आज शाम को आएगा क्या", I.askContact, { contact: SUNIL }),
    ex(S.hinglish, "Sunil abhi kidhar hai pata karo", I.askContact, { contact: SUNIL }),
    ex(S.kn, "ರವಿ ಎಲ್ಲಿದ್ದಾರೆ ಅಂತ ಕೇಳಿ", I.askContact, { contact: RAVI }),
    ex(S.kanglish, "Raju elli iddaare keli nodi", I.askContact, { contact: RAJU }),
  ],
  [I.setRule]: [
    ex(S.en, "let Meera see where I am", I.setRule, { contact: MEERA }),
    ex(S.en, "don't tell Ravi my address", I.setRule, { contact: RAVI }),
    ex(S.hi, "सीमा को मेरे नोट्स मत दिखाना", I.setRule, { contact: SEEMA }),
    ex(S.hinglish, "Ravi ko mera kaam ka time pata chal sakta hai, allow karo", I.setRule, { contact: RAVI }),
    ex(S.kn, "ರವಿಗೆ ನನ್ನ ವಿಳಾಸ ಹೇಳಬೇಡಿ", I.setRule, { contact: RAVI }),
    ex(S.kanglish, "Seema ge nanna location nodoke bidi", I.setRule, { contact: SEEMA }),
    ex(S.en, "Sunil can ask me about my timings", I.setRule, { contact: SUNIL }),
    ex(S.hi, "सीमा मेरी कमाई देख सकती है", I.setRule, { contact: SEEMA }),
    ex(S.hinglish, "Sunil kuch puche to mat batana", I.setRule, { contact: SUNIL }),
    ex(S.kn, "ಸೀಮಾ ನನ್ನ ಟೈಮಿಂಗ್ ಕೇಳಬಹುದು", I.setRule, { contact: SEEMA }),
    ex(S.kanglish, "Ravi nanna number nodbaardu block maadi", I.setRule, { contact: RAVI }),
  ],
  [I.chat]: [
    ex(S.en, "hello", I.chat),
    ex(S.en, "my brother is shifting to Bangalore", I.chat),
    ex(S.en, "I paid the electrician 600 yesterday", I.chat),
    ex(S.hi, "धन्यवाद", I.chat),
    ex(S.hinglish, "aaj teen ghar ka khana banaya", I.chat),
    ex(S.kn, "ಒಂದು ಜೋಕ್ ಹೇಳು", I.chat),
    ex(S.kanglish, "nanna akka Chennai ge hogtidaare", I.chat),
  ],
  [I.guide]: [
    ex(S.en, "where can I find a cheap room?", I.guide),
    ex(S.hi, "यहाँ राशन कार्ड के लिए क्या चाहिए", I.guide),
    ex(S.hinglish, "SIM kaise milega", I.guide),
    ex(S.kn, "ಬ್ಯಾಂಕ್ ಖಾತೆ ಹೇಗೆ ತೆರೆಯುವುದು", I.guide),
    ex(S.kanglish, "illi bus pass hege maadsodu", I.guide),
  ],
};
