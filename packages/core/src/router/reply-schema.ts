import { City, Trade } from "@gigsync/protocol";
import { PILOT_AREAS } from "../estimate/areas.js";
import { FIELDS } from "../interview/card.js";
import { allowedIntents, type IntentContext } from "./intent.js";

/**
 * The JSON Schema the routing reply must fit, for an engine that can hold its output to one (WebLLM's grammar, Ollama's
 * `format`): the intent required and one of this chat's, each slot one of the values core accepts, the contact one of
 * the owner's own. A small model then cannot invent an intent or a trade, misspell a contact or break the JSON; core
 * still checks every value, since an engine without a grammar ignores the schema.
 */

export type JsonSchema = Readonly<Record<string, unknown>>;

const STRING = "string";
const enumOf = (values: readonly string[]) => ({ type: STRING, enum: values });

export function replySchema(ctx: IntentContext): JsonSchema {
  return {
    type: "object",
    properties: {
      intent: enumOf(allowedIntents(ctx)),
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
