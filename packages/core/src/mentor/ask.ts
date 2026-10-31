import { type City, ColleagueNote, EnvelopeKind, type UserId } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import { type MentorContext, mustReach } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { known } from "./known.js";
import { sendNote } from "./link.js";

/**
 * Asks someone this owner knows whether they know someone in `city`, in the owner's language. On a live mentor link
 * it is a note in the link's thread; to the other side of a signed job it travels on that job's channel and lands
 * with the job's notes on their phone. An ended link has no channel left to ask on.
 */
export async function askAround(m: MentorContext, user: UserId, city: City): Promise<void> {
  const lang = m.ctx.lang;
  const text = t(lang, "mentor.intro_ask_note", { city: t(lang, `mentor.city.${city}`) });
  const person = await known(m, user);
  if (!person.channel) throw new MentorError(MentorRefusal.notLinked);
  const link = await m.links.get(user);
  if (link?.channel === person.channel) return sendNote(m, user, text, lang);
  // A job's channel is read by every GigSync since mentors; an older phone would stall on a body it cannot parse.
  await mustReach(m, user);
  await m.transport.send(user, person.channel, EnvelopeKind.enum.colleague_note, ColleagueNote.parse({ text, lang }));
}
