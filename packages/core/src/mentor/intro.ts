import {
  type City,
  type ColleagueCard,
  type EngagementId,
  EnvelopeKind,
  Introduce,
  type MentorAccept,
  MentorReply,
  MentorRole,
  type UserId,
} from "@gigsync/protocol";
import { ColleagueState } from "../colleague/types.js";
import { type MentorContext, mustReach, newChannel } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { isExpired } from "./expiry.js";
import { openMentorLink } from "./link.js";
import { mustHaveSeenSafety } from "./request.js";
import type { Introduction } from "./types.js";

const K = EnvelopeKind.enum;
const R = MentorReply.enum;
const { mentor: MENTOR, newcomer: NEWCOMER } = MentorRole.enum;

/** The other role in a pair: a newcomer's other side is a mentor, and the other way round. */
export const otherRole = (role: MentorRole): MentorRole => (role === MENTOR ? NEWCOMER : MENTOR);

/** A colleague this phone is linked with now (in person, or a mentor link not yet run out), with their card. */
async function linkedCard(m: MentorContext, user: UserId): Promise<ColleagueCard> {
  const c = await m.c.store.get(user);
  if (c?.state !== ColleagueState.linked || isExpired(c, m.c.ctx.clock.now()))
    throw new MentorError(MentorRefusal.notLinked);
  if (await m.store.isBlocked(user)) throw new MentorError(MentorRefusal.blocked);
  return c.card;
}

/**
 * Introduces two of this owner's linked colleagues: `newcomer`, who is moving to `city`, and `mentor`, who knows it.
 * Each gets an `introduce` naming the other and who introduced them, on one fresh channel that the mentor link will
 * use if both say yes. No code to scan: this owner's own links vouch for both.
 */
export async function introduce(
  m: MentorContext,
  pair: { newcomer: UserId; mentor: UserId; city: City; note?: string },
): Promise<void> {
  if (pair.newcomer === pair.mentor) throw new MentorError(MentorRefusal.notLinked);
  const [newcomerCard, mentorCard] = await Promise.all([linkedCard(m, pair.newcomer), linkedCard(m, pair.mentor)]);
  await Promise.all([mustReach(m, pair.newcomer), mustReach(m, pair.mentor)]);
  const channel = newChannel(m);
  const by = { user: m.c.ctx.me.user, name: m.c.ctx.contact.name };
  const note = pair.note?.trim() ? { note: pair.note.trim() } : {};
  const toNewcomer = Introduce.parse({
    other: pair.mentor,
    card: mentorCard,
    city: pair.city,
    other_role: MENTOR,
    by,
    ...note,
  });
  const toMentor = Introduce.parse({
    other: pair.newcomer,
    card: newcomerCard,
    city: pair.city,
    other_role: NEWCOMER,
    by,
    ...note,
  });
  await m.c.transport.send(pair.newcomer, channel, K.introduce, toNewcomer);
  await m.c.transport.send(pair.mentor, channel, K.introduce, toMentor);
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
  await m.c.transport.send(i.other, channel, K.mentor_accept, body);
  const next = await m.store.updateIntro(channel, (old) => old && { ...old, mine: reply });
  if (next) await openIfBoth(m, next);
}

/** An introduction from a linked colleague, naming someone else; anything else is dropped without a trace. */
export async function onIntroduce(
  m: MentorContext,
  from: UserId,
  channel: EngagementId,
  body: Introduce,
): Promise<boolean> {
  const now = m.c.ctx.clock.now();
  const by = await m.c.store.get(from);
  const fromColleague = by?.state === ColleagueState.linked && !isExpired(by, now) && body.by.user === from;
  if (!fromColleague || body.other === m.c.ctx.me.user || (await m.store.isBlocked(body.other))) return false;
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
