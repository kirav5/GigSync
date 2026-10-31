import {
  type ColleagueCard,
  type EngagementId,
  EnvelopeKind,
  LandingRequest,
  MAX_LANDING_REQUESTS,
  type MentorAccept,
  type MentorCard,
  type MentorOffer,
  type MentorProfile,
  MentorReply,
  MentorRole,
} from "@gigsync/protocol";
import { type MentorContext, mustReach, newChannel, reachesMentor } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { openMentorLink } from "./link.js";
import { myRecord } from "./listing.js";
import { RequestState, type SentRequest } from "./types.js";

const K = EnvelopeKind.enum;
const R = MentorReply.enum;
const S = RequestState;

/** What a newcomer says about their move (any day of the arrival week will do); their card is added when it is sent. */
export type LandingAsk = Omit<LandingRequest, "card">;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** `Date.getUTCDay()` counts from Sunday; a landing request names the Monday of its week. */
const MONDAY = 1;
/** Length of "YYYY-MM-DD" at the start of an ISO time. */
const DAY_LENGTH = 10;

/** The Monday ("YYYY-MM-DD") of the week a day ("YYYY-MM-DD") falls in. */
export function mondayOf(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (at.getUTCDay() - MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return new Date(at.getTime() - sinceMonday * MS_PER_DAY).toISOString().slice(0, DAY_LENGTH);
}

/** A request still waiting on someone: sent and unanswered, or offered and not confirmed. */
export const isOpenRequest = (r: { state: RequestState }) => r.state === S.sent || r.state === S.offered;

/** The safety words come first; the screen shows them, and only then may anything be sent. */
export async function mustHaveSeenSafety(m: MentorContext): Promise<void> {
  if (!(await m.store.newcomer())?.safety_seen) throw new MentorError(MentorRefusal.safetyFirst);
}

/**
 * Sends a landing request to each mentor the newcomer picked (at most MAX_LANDING_REQUESTS at once), each on its own
 * fresh channel. A mentor already asked and still open is not asked twice. Mentors whose phones are too old for
 * mentors are left out and returned, so the screen can name them.
 */
export async function sendRequests(
  m: MentorContext,
  picks: readonly MentorProfile[],
  ask: LandingAsk,
  card: ColleagueCard,
): Promise<{ sent: SentRequest[]; tooOld: MentorProfile[] }> {
  if (picks.length > MAX_LANDING_REQUESTS) throw new MentorError(MentorRefusal.tooMany);
  await mustHaveSeenSafety(m);
  const body = LandingRequest.parse({ ...ask, arrival_week: mondayOf(ask.arrival_week), card });
  const [open, blocked] = await Promise.all([m.store.sent(), m.store.blocked()]);
  const asked = new Set(open.filter(isOpenRequest).map((r) => r.mentor));
  const fresh = picks.filter((p) => p.user !== m.ctx.me.user && !blocked.has(p.user) && !asked.has(p.user));
  const reach = await Promise.all(fresh.map((p) => reachesMentor(m, p.user)));
  const sent: SentRequest[] = [];
  for (const [i, profile] of fresh.entries()) {
    if (!reach[i]) continue;
    const channel = newChannel(m);
    await m.transport.send(profile.user, channel, K.landing_request, body);
    const at = m.ctx.clock.now().toISOString();
    const r: SentRequest = { channel, mentor: profile.user, profile, state: S.sent, at };
    await m.store.saveSent(r);
    sent.push(r);
  }
  return { sent, tooOld: fresh.filter((_, i) => !reach[i]) };
}

/** Mentor side: yes to a landing request, with this owner's card, their own record and any vouched badge. */
export async function offer(
  m: MentorContext,
  channel: EngagementId,
  card: ColleagueCard,
  note?: string,
): Promise<void> {
  const r = await m.store.receivedOn(channel);
  if (r?.state !== S.sent) throw new MentorError(MentorRefusal.notFound);
  await mustReach(m, r.from);
  const record = await myRecord(m);
  const choices = await m.store.choices();
  // The work and languages the newcomer chose them by, as listed, over the card's.
  const listed = choices ? { trades: choices.trades, languages: choices.languages } : {};
  const vouched_by = choices?.vouched_by ?? null;
  const mine: MentorCard = { ...card, ...listed, months: record.months, jobs: record.jobs, vouched_by };
  const body: MentorOffer = { reply: R.accept, card: mine, ...(note?.trim() ? { note: note.trim() } : {}) };
  await m.transport.send(r.from, channel, K.mentor_offer, body);
  await m.store.saveReceived({ ...r, state: S.offered });
}

/** Mentor side: no to a landing request, said kindly; the newcomer's other requests carry on. */
export async function decline(m: MentorContext, channel: EngagementId): Promise<void> {
  const r = await m.store.receivedOn(channel);
  if (r?.state !== S.sent) throw new MentorError(MentorRefusal.notFound);
  const body: MentorOffer = { reply: R.decline };
  if (await reachesMentor(m, r.from)) await m.transport.send(r.from, channel, K.mentor_offer, body);
  await m.store.saveReceived({ ...r, state: S.declined });
}

/**
 * Newcomer side: confirms one mentor's offer, which opens the 30-day mentor link on both phones, then closes every
 * other open request politely, so no other mentor keeps waiting.
 */
export async function confirm(m: MentorContext, channel: EngagementId): Promise<void> {
  const r = await m.store.sentOn(channel);
  if (r?.state !== S.offered || !r.card) throw new MentorError(MentorRefusal.notFound);
  await mustReach(m, r.mentor);
  const yes: MentorAccept = { reply: R.accept };
  await m.transport.send(r.mentor, channel, K.mentor_accept, yes);
  const { months, jobs, vouched_by, ...card } = r.card;
  const side = { role: MentorRole.enum.newcomer, months, jobs, vouched_by };
  await openMentorLink(m, { user: r.mentor, card, channel, side });
  await m.store.saveSent({ ...r, state: S.linked });
  await withdrawOthers(m, channel);
}

/** Closes every other open request with a polite `withdraw`. */
async function withdrawOthers(m: MentorContext, kept: EngagementId): Promise<void> {
  const others = (await m.store.sent()).filter((r) => r.channel !== kept && isOpenRequest(r));
  for (const r of others) await withdraw(m, r);
}

/** Closes one request: tells the mentor when their phone can hear it, and marks it closed here either way. */
export async function withdraw(m: MentorContext, r: SentRequest): Promise<void> {
  const body: MentorAccept = { reply: R.withdraw };
  if (await reachesMentor(m, r.mentor)) await m.transport.send(r.mentor, r.channel, K.mentor_accept, body);
  await m.store.saveSent({ ...r, state: S.closed });
}
