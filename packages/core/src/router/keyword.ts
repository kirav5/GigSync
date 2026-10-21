/**
 * The fallback router, used when no model is available ("lite mode") and as the first line in tests. Patterns only;
 * the model router that replaces it in M1 must return the same `Route` shape so experts never notice the swap.
 * English and Hindi (Latin script) words, since that is what the first users type.
 */
export type Expert = "remember" | "askSelf" | "askContact" | "setRule" | "find" | "chat";

export interface Route {
  expert: Expert;
  /** A contact's name if the message names one that the owner has. */
  contact?: string;
  text: string;
}

const REMEMBER = /^(remember|note|yaad rakhna|yaad rakh|save)\b[:\s]*/i;
const RULE =
  /\b(let|allow|permit|stop|don't let|dont let|de do|dekhne do)\b.*\b(see|know|ask|location|where|free|busy|dekh)/i;
const FIND =
  /\b(find|need|book|hire|chahiye|dhundo|looking for|get me|get)\b.*\b(electrician|plumber|tutor|cook|caterer|driver|ac|repair|service|cleaner|someone|koi)\b/i;
const ASK_SELF = /\b(what did|when did|where did|did i|what's my|what is my|my notes|kya kaha|kab)\b/i;
const ASK_CONTACT = /\b(is|are|where is|where's|when is|ask|free|busy|kahan|kahaan|khaali|free hai)\b/i;

export function routeByKeywords(text: string, contacts: readonly string[]): Route {
  const t = text.trim();
  const contact = contacts.find((c) => new RegExp(`\\b${escapeRe(c)}\\b`, "i").test(t));

  if (REMEMBER.test(t)) return { expert: "remember", text: t.replace(REMEMBER, "") };
  if (RULE.test(t) && contact) return { expert: "setRule", contact, text: t };
  if (FIND.test(t)) return { expert: "find", text: t };
  if (contact && ASK_CONTACT.test(t)) return { expert: "askContact", contact, text: t };
  if (ASK_SELF.test(t) || contact) return { expert: "askSelf", ...(contact ? { contact } : {}), text: t };
  return { expert: "chat", text: t };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
