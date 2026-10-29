import {
  type City,
  type EngagementId,
  EnvelopeKind,
  Introduce,
  type MentorAccept,
  MentorReply,
  MentorRole,
  type UserId,
} from "@gigsync/protocol";
import { type MentorContext, mustReach, newChannel } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { known, knows } from "./known.js";
import { openMentorLink } from "./link.js";
import { mustHaveSeenSafety } from "./request.js";
import type { Introduction } from "./types.js";

const K = EnvelopeKind.enum;
const R = MentorReply.enum;
const { mentor: MENTOR, newcomer: NEWCOMER } = MentorRole.enum;

/** The other role in a pair: a newcomer's other side is a mentor, and the other way round. */
export const otherRole = (role: MentorRole): MentorRole => (role === MENTOR ? NEWCOMER : MENTOR);

/**
 * Introduces two people this owner knows (a job both sides signed, or a mentor link, with each): `newcomer`, who is
 * moving to `city`, and `mentor`, who knows it. Each gets an `introduce` naming the other and who introduced them, on
 * one fresh channel that the mentor link will use if both say yes. This owner's own dealings with each vouch for both.
 */
export async function introduce(
  m: MentorContext,
  pair: { newcomer: UserId; mentor: UserId; city: City; note?: string },
): Promise<void> {
  if (pair.newcomer === pair.mentor) throw new MentorError(MentorRefusal.notKnown);
  const [newcomer, mentor] = await Promise.all([known(m, pair.newcomer), known(m, pair.mentor)]);
  await Promise.all([mustReach(m, pair.newcomer), mustReach(m, pair.mentor)]);
  const channel = newChannel(m);
  const by = { user: m.ctx.me.user, name: m.ctx.contact.name };
  const note = pair.note?.trim() ? { note: pair.note.trim() } : {};
  const toNewcomer = Introduce.parse({
    other: pair.mentor,
    card: mentor.card,
    city: pair.city,
    other_role: MENTOR,
    by,
    ...note,
  });
  const toMentor = Introduce.parse({
    other: pair.newcomer,
    card: newcomer.card,
    city: pair.city,
    other_role: NEWCOMER,
    by,
    ...note,
  });
  await m.transport.send(pair.newcomer, channel, K.introduce, toNewcomer);
  await m.transport.send(pair.mentor, channel, K.introduce, toMentor);
}

/** Both said yes: the mentor link opens on this phone, with this owner on their side of it. */
async function openIfBoth(m: MentorContext, i: Introduction): Promise<void> {
  if (i.mine !== R.accept || i.theirs !== R.accept) return;
  const side = { role: otherRole(i.other_role) };
  await openMentorLink(m, { user: i.other, card: i.card, channel: i.channel, side });
}

/**
 * This owner's yes or no to an introduction, sent to the other person on the introduction's channel. A no is kept
 * here too, so the introduction leaves the screen. The link opens once both have said yes.
 */
export async function answerIntro(m: MentorContext, channel: EngagementId, reply: MentorReply): Promise<void> {
  const i = await m.store.intro(channel);
  if (!i || i.mine !== undefined || reply === R.withdraw) throw new MentorError(MentorRefusal.notFound);
  if (reply === R.accept) await mustHaveSeenSafety(m);
  await mustReach(m, i.other);
  const body: MentorAccept = { reply };
  await m.transport.send(i.other, channel, K.mentor_accept, body);
  const next = await m.store.updateIntro(channel, (old) => old && { ...old, mine: reply });
  if (next) await openIfBoth(m, next);
}

/**
 * An introduction from someone this owner knows (a signed job or a mentor link), naming someone else; anything else,
 * a stranger's above all, is dropped without a trace.
 */
export async function onIntroduce(
  m: MentorContext,
  from: UserId,
  channel: EngagementId,
  body: Introduce,
): Promise<boolean> {
  const now = m.ctx.clock.now();
  if (body.by.user !== from || body.other === m.ctx.me.user || (await m.store.isBlocked(body.other))) return false;
  if (!(await knows(m, from))) return false;
  const early = await m.store.takeEarly(channel);
  const theirs = early?.from === body.other ? { theirs: early.reply } : {};
  const kept = await m.store.updateIntro(channel, (old) =>
    old ? undefined : { channel, ...body, ...theirs, at: now.toISOString() },
  );
  return kept !== undefined;
}

/**
 * The other side's answer to an introduction. One that comes before the introduction itself (two senders, no shared
 * order) is kept until it arrives; it counts only if the introduction then names its sender.
 */
export async function onIntroAnswer(m: MentorContext, from: UserId, channel: EngagementId, reply: MentorReply) {
  const i = await m.store.intro(channel);
  if (!i) {
    if (reply !== R.withdraw) await m.store.keepEarly({ channel, from, reply });
    return;
  }
  if (i.other !== from || i.theirs !== undefined) return;
  const next = await m.store.updateIntro(channel, (old) => old && { ...old, theirs: reply });
  if (next) await openIfBoth(m, next);
}
