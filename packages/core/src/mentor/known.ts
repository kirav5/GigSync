import { type ColleagueCard, type EngagementId, Role, type UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import { bothSigned } from "../payments/passbook.js";
import type { MentorContext } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { sweepExpired } from "./link.js";

/**
 * Someone this owner knows, in the only two ways that count for an introduction: a job both sides signed, or a mentor
 * link, live or ended.
 */
export interface KnownPerson {
  user: UserId;
  card: ColleagueCard;
  /** They did the work on a job with this owner, or are on a mentor link: a worker, who can be introduced. */
  worker: boolean;
  /** Where a note to them goes: a live mentor link's channel, or the signed job's. Absent once a link has ended. */
  channel?: EngagementId;
}

/**
 * The other side's name on a job both sides signed: from their contact card, which comes once both have signed, or
 * kept from it after it was removed once the job was settled (ADR 0039 §3).
 */
const signedName = (r: JobRecord): string | undefined =>
  bothSigned(r) ? (r.contact?.name ?? r.their_name) : undefined;

/** The other side of a signed job, as an introduction names them: the trade they did, or the language they wrote in. */
function jobPerson(r: JobRecord, name: string): KnownPerson {
  const theyWorked = r.engagement.role === Role.enum.requester;
  const card: ColleagueCard = {
    name,
    trades: theyWorked ? [r.request.trade] : [],
    languages: theyWorked ? [] : [r.request.lang],
  };
  return { user: r.engagement.counterpart, card, worker: theyWorked, channel: r.engagement.id };
}

const oldestFirst = (a: JobRecord, b: JobRecord) => a.engagement.created_at.localeCompare(b.engagement.created_at);

/**
 * Everyone this phone knows by name, once each, blocked or not. Where one person is known more than one way, a live
 * link wins (its notes have a thread), then the latest signed job, then an ended link.
 */
async function byName(m: MentorContext): Promise<Map<UserId, KnownPerson>> {
  const [live, past, jobs] = await Promise.all([
    sweepExpired(m.links, m.ctx.clock.now()),
    m.links.past(),
    m.ctx.store.jobs(),
  ]);
  const byUser = new Map<UserId, KnownPerson>();
  const keep = (p: KnownPerson) =>
    byUser.set(p.user, { ...p, worker: p.worker || byUser.get(p.user)?.worker === true });
  for (const p of past) keep({ user: p.user, card: p.card, worker: true });
  for (const r of [...jobs].sort(oldestFirst)) {
    const name = signedName(r);
    if (name) keep(jobPerson(r, name));
  }
  for (const l of live) keep({ user: l.user, card: l.card, worker: true, channel: l.channel });
  return byUser;
}

/** Everyone this owner knows, once each, by name, leaving out this owner and anyone blocked. */
export async function people(m: MentorContext): Promise<KnownPerson[]> {
  const [known, blocked] = await Promise.all([byName(m), m.store.blocked()]);
  return [...known.values()]
    .filter((p) => p.user !== m.ctx.me.user && !blocked.has(p.user))
    .sort((a, b) => a.card.name.localeCompare(b.card.name));
}

/** Someone this owner blocked, and when; `name` only when this phone knew them by one (a signed job or a link). */
export interface BlockedPerson {
  user: UserId;
  name?: string;
  at: string;
}

/** Everyone this owner blocked, newest first, by the name this phone knew them by where it knew one. */
export async function blockedPeople(m: MentorContext): Promise<BlockedPerson[]> {
  const [known, blocks] = await Promise.all([byName(m), m.store.blocks()]);
  return blocks
    .map((b) => {
      const name = known.get(b.user)?.card.name;
      return name === undefined ? { user: b.user, at: b.at } : { user: b.user, name, at: b.at };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Someone this owner knows, or a refusal: a blocked person, or someone neither on a link nor on a signed job here. */
export async function known(m: MentorContext, user: UserId): Promise<KnownPerson> {
  if (await m.store.isBlocked(user)) throw new MentorError(MentorRefusal.blocked);
  const person = (await people(m)).find((p) => p.user === user);
  if (!person) throw new MentorError(MentorRefusal.notKnown);
  return person;
}

/** True when this owner knows `user` (and has not blocked them): what an introduction from them must rest on. */
export async function knows(m: MentorContext, user: UserId): Promise<boolean> {
  return (await people(m)).some((p) => p.user === user);
}
