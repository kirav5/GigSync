/**
 * The fallback router, used when no model is available ("lite mode") and as the first line in tests. Patterns only;
 * the model router that replaces it in M1 must return the same `Route` shape so experts never notice the swap.
 * English and Hindi in Latin script, plus Hindi in Devanagari and Kannada in Kannada script for owners who chose
 * those languages. JavaScript's `\b` only knows ASCII letters, so the Indic patterns spell their own boundaries.
 */
export const Expert = {
  remember: "remember",
  askSelf: "askSelf",
  askContact: "askContact",
  setRule: "setRule",
  find: "find",
  chat: "chat",
} as const;
export type Expert = (typeof Expert)[keyof typeof Expert];

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

const REMEMBER_INDIC = /^(याद रखना|याद रखो|याद रख|नोट करो|नोट कर लो|ನೆನಪಿಡು|ನೆನಪಿಟ್ಟುಕೊ|ಬರೆದಿಡು)[\s:,।-]*/u;
const REMEMBER_INDIC_END = /[\s,]*(याद रखना|याद रखो|ನೆನಪಿಡು)[\s।.]*$/u;
const ASK_SELF_INDIC = /(क्या लिखा|क्या कहा|क्या नोट|मैंने क्या|कब तक|ಏನು ಬರೆದಿದ್ದೆ|ಏನು ಹೇಳಿದ್ದೆ|ನಾನು ಏನು|ಯಾವಾಗ)/u;
const NEED_INDIC = /(चाहिए|ढूँढो|ढूंढो|बुक करो|ಬೇಕು|ಹುಡುಕಿ|ಹುಡುಕು)/u;
const SOMEONE_INDIC =
  /(इलेक्ट्रीशियन|बिजली|प्लंबर|रसोइया|खाना बनाने|कामवाली|ड्राइवर|बढ़ई|पेंटर|कोई|ಎಲೆಕ್ಟ್ರಿಷಿಯನ್|ಪ್ಲಂಬರ್|ಅಡುಗೆ|ಚಾಲಕ|ಡ್ರೈವರ್|ಕೆಲಸದವರು|ಯಾರಾದರೂ)/u;
/** Letters and combining marks in any script: a name inside a longer word is not that name. */
const LETTER = "[\\p{L}\\p{M}]";

/** The note itself, with the "remember" words taken off the front or the back; undefined when it is not a note. */
function noteText(t: string): string | undefined {
  if (REMEMBER.test(t)) return t.replace(REMEMBER, "");
  if (REMEMBER_INDIC.test(t)) return t.replace(REMEMBER_INDIC, "");
  if (REMEMBER_INDIC_END.test(t)) return t.replace(REMEMBER_INDIC_END, "");
  return undefined;
}

/** The first of the owner's contacts the words name, as a whole name. */
export const namedContact = (text: string, contacts: readonly string[]): string | undefined =>
  contacts.find((c) => new RegExp(`(?<!${LETTER})${escapeRe(c)}(?!${LETTER})`, "iu").test(text));

export function routeByKeywords(text: string, contacts: readonly string[]): Route {
  const t = text.trim();
  const contact = namedContact(t, contacts);
  const note = noteText(t);

  if (note !== undefined) return { expert: Expert.remember, text: note };
  if (RULE.test(t) && contact) return { expert: Expert.setRule, contact, text: t };
  if (FIND.test(t) || (NEED_INDIC.test(t) && SOMEONE_INDIC.test(t))) return { expert: Expert.find, text: t };
  if (contact && ASK_CONTACT.test(t)) return { expert: Expert.askContact, contact, text: t };
  if (ASK_SELF.test(t) || ASK_SELF_INDIC.test(t) || contact)
    return { expert: Expert.askSelf, ...(contact ? { contact } : {}), text: t };
  return { expert: Expert.chat, text: t };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
