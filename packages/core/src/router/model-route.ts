import { City, PAISE_PER_RUPEE, Trade } from "@gigsync/protocol";
import { z } from "zod";
import { matchContact, namedIn } from "../contacts/names.js";
import { PILOT_AREA_CHOICES } from "../estimate/area-names.js";
import { areaSlug } from "../estimate/areas.js";
import { FIELDS } from "../interview/card.js";
import { areaIn, type Field } from "../interview/lexicon.js";
import { firstObject, within } from "../interview/need-model.js";
import { asciiDigits, numbersIn } from "../job/details.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";
import {
  ChatIntent,
  type ChatRoute,
  type ChatSlots,
  type IntentContext,
  intentAllowed,
  RouteVia,
  routeComplete,
} from "./intent.js";
import { wordsBear } from "./keyword-route.js";
import { routePrompt } from "./model-prompt.js";
import { replySchema } from "./reply-schema.js";

/**
 * The phone's own model names a message's intent (ADR 0040): it never acts, it only names. Its reply is JSON checked
 * by a zod schema, and a slot is kept only when core can verify it against what it knows and what the owner said: a
 * trade from the list, a pilot area the words name, a contact the owner has, an amount whose digits are in the words,
 * a note cut from the words. An intent this chat cannot have, one missing what its action needs (a contact, a note),
 * a reply that is not the JSON asked for, no model, or no answer in time, and the word lists answer instead.
 */

/** How long a message waits for the model to name its intent before the word lists answer instead. */
export const MODEL_ROUTE_TIMEOUT_MS = 5000;
/** The same text gets the same route: routing is a lookup, not writing. */
const ROUTING_TEMPERATURE = 0;
/** Room for the intent and a short note as JSON. */
const MAX_TOKENS = 120;
/** No slot value from a well-behaved model is longer; a note is cut from the message, which the chat caps anyway. */
const SLOT_MAX = 80;
const NOTE_MAX = 1000;
/** No amount anyone asks about in the pilot comes near this, in rupees. */
const MAX_AMOUNT_RUPEES = 10_000_000;
const GROUPING = /(?<=\d),(?=\d)/g;
const NOT_DIGIT = /\D/g;
const END_MARKS = /[\s.!?।,]+$/u;

export interface ModelRouteOptions {
  timeoutMs?: number;
}

/** A slot of the wrong shape or length is dropped on its own, as one that fails its check is: the rest still count. */
const Text = (max: number) => z.string().max(max).nullish().catch(null);
/** The reply as asked for; slots the model left empty are null or missing, and checked one by one after. */
const Reply = z.object({
  intent: z.string().max(SLOT_MAX),
  trade: Text(SLOT_MAX),
  area: Text(SLOT_MAX),
  city: Text(SLOT_MAX),
  amount: z
    .union([z.number(), z.string().max(SLOT_MAX)])
    .nullish()
    .catch(null),
  contact: Text(SLOT_MAX),
  field: Text(SLOT_MAX),
  note: Text(NOTE_MAX),
});
type Reply = z.infer<typeof Reply>;

const lower = (s: string) => s.trim().toLowerCase();
const given = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;
const INTENTS = Object.values(ChatIntent);

/** The reply's object, with slots a model nested under "slots" lifted up beside the intent. */
function parseReply(reply: string): Reply | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    const raw: unknown = JSON.parse(object);
    if (!raw || typeof raw !== "object") return undefined;
    const nested = "slots" in raw && raw.slots && typeof raw.slots === "object" ? raw.slots : {};
    return Reply.safeParse({ ...raw, ...nested }).data;
  } catch {
    return undefined;
  }
}

/** One of the listed values, any case. */
function oneOf<T extends string>(value: string | null | undefined, values: readonly T[]): T | undefined {
  return given(value) ? values.find((v) => lower(v) === lower(value)) : undefined;
}

/** A pilot area by key, slug or any name, and only when the owner's own words name that same area. */
function checkArea(value: string | null | undefined, text: string): string | undefined {
  if (!given(value)) return undefined;
  const said = lower(value);
  const choice = PILOT_AREA_CHOICES.find(
    (a) => a.key === said || areaSlug(a.key) === said || a.names.some((n) => lower(n) === said),
  );
  return choice && areaIn(text, PILOT_AREA_CHOICES) === choice.key ? choice.key : undefined;
}

/** Rupees whose digits are in the owner's words, in any script, with or without grouping commas; as paise. */
function checkAmount(value: number | string | null | undefined, text: string): number | undefined {
  if (value === null || value === undefined || (typeof value === "string" && !given(value))) return undefined;
  const rupees = typeof value === "number" ? value : Number(asciiDigits(value).replace(NOT_DIGIT, ""));
  if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_AMOUNT_RUPEES) return undefined;
  return numbersIn(asciiDigits(text).replace(GROUPING, "")).includes(rupees) ? rupees * PAISE_PER_RUPEE : undefined;
}

/** A note that is the owner's own words, cut from the message; trailing marks do not count against it. */
function checkNote(value: string | null | undefined, text: string): string | undefined {
  if (!given(value)) return undefined;
  const note = value.trim().replace(END_MARKS, "");
  return note && lower(text).includes(lower(note)) ? note : undefined;
}

/**
 * The slots that check, each on its own: one core cannot verify is dropped and the rest kept, so a wrong area or an
 * amount the owner never said never reaches an action, and the intent still counts.
 */
function checkSlots(reply: Reply, text: string, ctx: IntentContext): ChatSlots {
  const trade = oneOf(reply.trade, Trade.options);
  const area = checkArea(reply.area, text);
  const city = oneOf(reply.city, City.options);
  const amount_paise = checkAmount(reply.amount, text);
  // A contact the message itself names: an engine held to the owner's list could otherwise pick one at random.
  const named = matchContact(reply.contact, ctx.contacts);
  const contact = named && namedIn(text, named) ? named : undefined;
  const field = oneOf<Field>(reply.field, FIELDS);
  const note = checkNote(reply.note, text);
  return {
    ...(trade ? { trade } : {}),
    ...(area ? { area } : {}),
    ...(city ? { city } : {}),
    ...(amount_paise ? { amount_paise } : {}),
    ...(contact ? { contact } : {}),
    ...(field ? { field } : {}),
    ...(note ? { note } : {}),
  };
}

/** The route a reply names, when its intent is this chat's and its action has what it needs, with the slots that check. */
function checkedRoute(reply: string, text: string, ctx: IntentContext): ChatRoute | undefined {
  const parsed = parseReply(reply);
  const intent = parsed && oneOf(parsed.intent, INTENTS);
  if (!parsed || !intent || !intentAllowed(intent, ctx)) return undefined;
  const slots = checkSlots(parsed, text, ctx);
  return routeComplete(intent, slots, ctx) && wordsBear(intent, text)
    ? { intent, slots, via: RouteVia.model }
    : undefined;
}

/** The intent the phone's model names, checked by core; undefined when there is none to trust. */
export async function modelRoute(
  text: string,
  ctx: IntentContext,
  model: Model,
  opts?: ModelRouteOptions,
): Promise<ChatRoute | undefined> {
  if (!text.trim()) return undefined;
  try {
    const answer = model.generate(routePrompt(text, ctx), {
      maxTokens: MAX_TOKENS,
      temperature: ROUTING_TEMPERATURE,
      json: true,
      schema: replySchema(ctx),
    });
    const reply = await within(answer, opts?.timeoutMs ?? MODEL_ROUTE_TIMEOUT_MS);
    const route = reply ? checkedRoute(reply, text, ctx) : undefined;
    if (reply && !route) log.debug("chat: model route rejected", { chars: reply.length });
    return route;
  } catch (err) {
    log.warn("chat: model route failed", { error: err instanceof Error ? err.name : String(err) });
    return undefined;
  }
}
