// Why the model router gave no route, read from the model's raw reply. Core only logs that it rejected one, so this
// repeats the outline of its checks (packages/core/src/router/model-route.ts) to name the first that failed; it is a
// diagnosis for the report, not a second router, and may drift from core's exact rules.
import { core, FIELDS, protocol } from "./core.mjs";

const Fallback = {
  noReply: "no reply (Ollama error or empty)",
  timeout: "slower than the time limit",
  notJson: "reply is not JSON",
  unknownIntent: "names an intent core does not know",
  notAllowed: "names an intent this owner cannot have here",
  trade: "names a trade not in the list",
  field: "names a card field not in the list",
  city: "names a city without a guide",
  contact: "names a contact the owner does not have",
  note: "note is not the owner's own words",
  areaOrAmount: "an area or amount not in the owner's words",
  missing: "leaves out a slot the intent needs",
};

const I = core.ChatIntent;
/** The slot each intent cannot act without, as core requires it. */
const NEEDS = { [I.editCard]: "field", [I.askContact]: "contact", [I.setRule]: "contact", [I.remember]: "note" };
const NOTE_END = /[\s.!?।,]+$/u;
const JSON_OBJECT = /\{[\s\S]*\}/;
const INTENTS = Object.values(core.ChatIntent);
const lower = (s) => String(s).trim().toLowerCase();
const given = (s) => s !== undefined && s !== null && String(s).trim().length > 0;
const outside = (value, values) => given(value) && !values.some((v) => lower(v) === lower(value));

/** The reply's object with slots nested under "slots" lifted beside the intent, as core reads it. */
function parsedReply(reply) {
  const found = reply.match(JSON_OBJECT);
  if (!found) return undefined;
  try {
    const raw = JSON.parse(found[0]);
    return raw && typeof raw === "object" ? { ...raw, ...(raw.slots ?? {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** True when the route lacks what its action needs: a market question needs a trade, the worker's own at least. */
function incomplete(intent, parsed, ctx) {
  const needed = NEEDS[intent];
  if (needed && !given(parsed[needed])) return true;
  return intent === I.market && !given(parsed.trade) && !(ctx.trades?.length > 0);
}

/** The first check a parsed reply fails, in about the order core makes them. */
function slotProblem(intent, parsed, text, ctx) {
  if (outside(parsed.trade, protocol.Trade.options)) return Fallback.trade;
  if (outside(parsed.field, FIELDS)) return Fallback.field;
  if (outside(parsed.city, protocol.City.options)) return Fallback.city;
  if (outside(parsed.contact, ctx.contacts)) return Fallback.contact;
  if (given(parsed.note) && !lower(text).includes(lower(parsed.note).replace(NOTE_END, ""))) return Fallback.note;
  if (incomplete(intent, parsed, ctx)) return Fallback.missing;
  return Fallback.areaOrAmount;
}

/** The reason for one case's fallback, from its last model call and how long the router waited. */
export function fallbackReason(calls, ms, timeoutMs, text, ctx) {
  const reply = calls.at(-1)?.reply;
  if (ms >= timeoutMs) return Fallback.timeout;
  if (!reply) return Fallback.noReply;
  const parsed = parsedReply(reply);
  if (!parsed) return Fallback.notJson;
  const intent = INTENTS.find((i) => lower(i) === lower(parsed.intent ?? ""));
  if (!intent) return Fallback.unknownIntent;
  if (!core.intentAllowed(intent, ctx)) return Fallback.notAllowed;
  return slotProblem(intent, parsed, text, ctx);
}
