import { City, Trade } from "@gigsync/protocol";
import { PILOT_AREAS } from "../estimate/areas.js";
import { FIELDS } from "../interview/card.js";
import { CLARIFY, MAX_CHOICES } from "./clarify.js";
import { allowedIntents, type IntentContext } from "./intent.js";

/**
 * The JSON Schema the routing reply must fit, for an engine that can hold its output to one (WebLLM's grammar, Ollama's
 * `format`): the intent required and one of this chat's, each slot one of the values core accepts, the contact one of
 * the owner's own. A small model then cannot invent an intent or a trade, misspell a contact or break the JSON; core
 * still checks every value, since an engine without a grammar ignores the schema. Where the chat may ask (Talk), the
 * intent may also be "clarify", with the two or three intents it could mean as its options.
 */

export type JsonSchema = Readonly<Record<string, unknown>>;

const STRING = "string";
const enumOf = (values: readonly string[]) => ({ type: STRING, enum: values });

export function replySchema(ctx: IntentContext): JsonSchema {
  const intents = allowedIntents(ctx);
  return {
    type: "object",
    properties: {
      intent: enumOf(ctx.mayAsk ? [...intents, CLARIFY] : intents),
      ...(ctx.mayAsk ? { options: { type: "array", items: enumOf(intents), maxItems: MAX_CHOICES } } : {}),
      trade: enumOf(Trade.options),
      area: enumOf(PILOT_AREAS.map((a) => a.key)),
      city: enumOf(City.options),
      amount: { type: "number" },
      ...(ctx.contacts.length > 0 ? { contact: enumOf(ctx.contacts) } : {}),
      field: enumOf(FIELDS),
      note: { type: STRING },
    },
    required: ["intent"],
    additionalProperties: false,
  };
}
