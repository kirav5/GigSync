import { City, Trade } from "@gigsync/protocol";
import { PILOT_AREAS } from "../estimate/areas.js";
import { FIELDS } from "../interview/card.js";
import { EXAMPLES } from "./examples.js";
import { allowedIntents, ChatIntent, ChatRole, type IntentContext } from "./intent.js";

/**
 * The one prompt the phone's model reads to name a message's intent (ADR 0040 §2): the intents this chat can have,
 * each with a short definition and examples in English, Hindi, Kannada and Hinglish, who is asking, and the values
 * slots may take. Short and JSON-only, so a small on-device model can follow it; core checks whatever comes back.
 */

const I = ChatIntent;

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
