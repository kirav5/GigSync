import { City, Trade } from "@gigsync/protocol";
import { PILOT_AREAS, type PilotArea } from "../estimate/areas.js";
import { FIELDS } from "../interview/card.js";
import type { Field } from "../interview/lexicon.js";
import { allowedIntents, ChatIntent, ChatRole, type IntentContext } from "./intent.js";

/**
 * The one prompt the phone's model reads to name a message's intent (ADR 0040 §2): the intents this chat can have,
 * each with a short definition and examples in English, Hindi, Kannada and Hinglish, who is asking, and the values
 * slots may take. Short and JSON-only, so a small on-device model can follow it; core checks whatever comes back.
 */

const I = ChatIntent;
const T = Trade.enum;

/** What each intent means, as the model is told it. */
const MEANING: Readonly<Record<ChatIntent, string>> = {
  [I.editCard]: "change something on their own GigSync card: rate, area, work, languages (field: what to change)",
  [I.helpOffer]: "offer to help people who are new to their city",
  [I.helpStop]: "they want to stop helping newcomers",
  [I.moving]: "they themselves are moving to another city for work, not someone else (city, if named)",
  [I.earnings]: "how much money they themselves earned, got paid or are still owed",
  [I.market]:
    "they ask what a kind of work costs, pays or charges, or if an amount is fair; not their own earnings (trade, area, amount)",
  [I.guide]: "a question about settling in the new city: a room, a bank, a SIM, documents, transport",
  [I.find]: "they ask for someone to come and do a job for them (not a price question, not work already done)",
  [I.remember]: "a note to keep for later (note: the words to keep)",
  [I.askSelf]: "a question about their own notes or what they said before",
  [I.askContact]: "a question to or about one of their contacts (contact)",
  [I.setRule]: "allow or stop a contact seeing or asking something (contact)",
  [I.chat]: "anything else: greetings, thanks, news, work already done, small talk",
};

/** The slots as the reply spells them: the amount in rupees, as people say it. */
interface ReplySlots {
  trade?: Trade;
  area?: PilotArea["key"];
  city?: City;
  amount?: number;
  contact?: string;
  field?: Field;
  note?: string;
}
/** One example: what an owner says, and the reply the model should give for it. */
interface Example {
  said: string;
  reply: ReplySlots & { intent: ChatIntent };
}
const ex = (said: string, intent: ChatIntent, slots: ReplySlots = {}): Example => ({
  said,
  reply: { intent, ...slots },
});

/** Two or three examples per intent, in the languages owners use. */
const EXAMPLES: Readonly<Record<ChatIntent, readonly Example[]>> = {
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

const or = (values: readonly string[]) => values.map((v) => JSON.stringify(v)).join(" | ");
const NONE = "none";
const LIST_GAP = ", ";

/** Who is asking, in a line or two. */
function whoLines(ctx: IntentContext): string[] {
  const who =
    ctx.role === ChatRole.household
      ? "The user is a household looking for help at home."
      : `The user is a worker talking to their own agent. Their work: ${ctx.trades?.join(LIST_GAP) || NONE}.`;
  return [
    who,
    `Their contacts: ${ctx.contacts.join(LIST_GAP) || NONE}.`,
    ...(ctx.inMove ? ["This chat is about their move to a new city."] : []),
  ];
}

/** The slots and the values each may take; only what the message itself says. */
const SLOT_LINES = [
  "Add a slot only when the message says it:",
  ` trade: ${or(Trade.options)}`,
  ` area: ${or(PILOT_AREAS.map((a) => a.key))}`,
  ` city: ${or(City.options)}`,
  " amount: rupees written in the message, as a number",
  " contact: one of their contacts, as written above",
  ` field: ${or(FIELDS)}`,
  " note: the words to keep, copied from the message",
];

/** The prompt for one message, with only the intents this chat can have. */
export function routePrompt(text: string, ctx: IntentContext): string {
  const intents = allowedIntents(ctx);
  return [
    "Sort one chat message from a GigSync user in India into one intent. Reply with one JSON object and nothing else.",
    ...whoLines(ctx),
    "Intents:",
    ...intents.map((intent) => `- ${intent}: ${MEANING[intent]}`),
    ...SLOT_LINES,
    "Examples:",
    ...intents.flatMap((intent) =>
      EXAMPLES[intent].map(({ said, reply }) => `${JSON.stringify(said)} -> ${JSON.stringify(reply)}`),
    ),
    `Message: ${JSON.stringify(text)}`,
  ].join("\n");
}
