import type { Lang } from "@gigsync/protocol";
import { EXAMPLES, type Example, Script } from "./examples.js";
import { allowedIntents, ChatIntent, ChatRole, type IntentContext } from "./intent.js";

/**
 * The one prompt the phone's model reads to name a message's intent (ADR 0040 §2): the intents this chat can have,
 * each with a short definition, the rules for the pairs models confuse, what each slot holds, and examples in the
 * script the message is written in (examples.ts). Short, because reading it is most of a phone's wait; the reply's
 * schema holds slot values, and core checks whatever comes back (docs/gigsync/model-comparison.md measured it).
 */

const I = ChatIntent;

/** What each intent means, as the model is told it. */
const MEANING: Readonly<Record<ChatIntent, string>> = {
  [I.editCard]: "change something on their own GigSync card: rate, area, work, languages (field: what to change)",
  [I.helpOffer]: "offer to help people who are new to their city, or to be a mentor",
  [I.helpStop]: "they want to stop helping newcomers or being a mentor, or be taken off that list",
  [I.moving]: "they themselves are moving or coming to another city for work, not someone else (city, if named)",
  [I.earnings]: "how much money they themselves earned, got paid or are still owed",
  [I.market]:
    "they ask a price, rate or salary for a kind of work, or if an amount is fair; not their own earnings (trade, area, amount)",
  [I.guide]: "a question about settling in the new city: a room, a bank, a SIM, documents, transport",
  [I.find]: "they want someone to come and do a job, or tell of something at home to fix (not a price question)",
  [I.remember]: "a note to keep: remember, note or write this down (note: the words to keep)",
  [I.askSelf]: "a question about what their own notes say or what they said before",
  [I.askContact]: "a question to or about one of their contacts (contact)",
  [I.setRule]: "permission: let a contact see, ask or be told something about them, or stop it (contact)",
  [I.chat]: "anything else: greetings, thanks, news, work already done, small talk",
};

/** The pairs small models confuse most, said once (the eval's commonest mistakes). */
const RULES = [
  "A trade word alone is not market: market is only a question about a price, rate or salary for work, or a fair amount.",
  "Setting their own rate, minimum, area, work, languages or about on their card is editCard, even with an amount.",
  "setRule is permission: a contact can or cannot see, know or ask something. askContact is a question to or about them.",
  "Asking what they wrote, noted or told before is askSelf, even when it names a trade or a person.",
  "Work already done, money already paid and news about someone else are chat.",
];

/** setRule just before askContact, chat still last: models reach for askContact whenever a contact is named. */
const PROMPT_ORDER: readonly ChatIntent[] = Object.values(ChatIntent).flatMap((intent) =>
  intent === ChatIntent.setRule ? [] : intent === ChatIntent.askContact ? [ChatIntent.setRule, intent] : [intent],
);

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

/** The slots and what each holds; the reply's schema already holds each to the values core accepts. */
const SLOT_LINES = [
  "Add a slot only when the message says it:",
  " trade, area, city: the kind of work, the area, the city it names",
  " amount: rupees written in the message, as a number",
  " contact: one of their contacts, as written above",
  " field: what to change on their card",
  " note: the words to keep, copied from the message",
];

const DEVANAGARI = /\p{Script=Devanagari}/u;
const KANNADA = /\p{Script=Kannada}/u;
/** In Latin letters, the owner's language is written the Latin way: Hinglish, Kanglish, or English. */
const LATIN_FOR: Readonly<Record<Lang, Script>> = { en: Script.en, hi: Script.hinglish, kn: Script.kanglish };

/** The examples to show: those in the script the message itself is written in, which keeps the prompt short. */
function scriptOf(text: string, lang: Lang): Script {
  if (DEVANAGARI.test(text)) return Script.hi;
  if (KANNADA.test(text)) return Script.kn;
  return LATIN_FOR[lang];
}

/** One example as the prompt shows it: the words, the intent and any slots, without JSON's quotes and braces. */
function exampleLine({ said, reply }: Example): string {
  return `${JSON.stringify(said)} -> ${JSON.stringify(reply)}`;
}

/** The prompt for one message, with only the intents this chat can have. */
export function routePrompt(text: string, ctx: IntentContext): string {
  const allowed = allowedIntents(ctx);
  const intents = PROMPT_ORDER.filter((intent) => allowed.includes(intent));
  const script = scriptOf(text, ctx.lang);
  return [
    "Sort one chat message from a GigSync user in India into one intent. Reply with one JSON object and nothing else.",
    ...whoLines(ctx),
    "Intents:",
    ...intents.map((intent) => `- ${intent}: ${MEANING[intent]}`),
    ...RULES,
    ...SLOT_LINES,
    "Examples:",
    ...intents.flatMap((intent) => EXAMPLES[intent].filter((e) => e.script === script).map(exampleLine)),
    `Message: ${JSON.stringify(text)}`,
  ].join("\n");
}
