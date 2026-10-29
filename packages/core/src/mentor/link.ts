import {
  type ColleagueCard,
  type ColleagueLink,
  type EngagementId,
  EnvelopeKind,
  LinkKind,
  LinkStep,
  type UserId,
} from "@gigsync/protocol";
import type { ColleagueRecord, ColleagueStore } from "../colleague/store.js";
import { type Colleague, ColleagueState } from "../colleague/types.js";
import { type MentorContext, mustReach } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { isExpired, mentorExpiry } from "./expiry.js";
import type { MentorSide } from "./types.js";

const K = EnvelopeKind.enum;

/** A mentor link, as opposed to a colleague met in person. */
export const isMentorLink = (c: Colleague): boolean => c.kind === LinkKind.enum.mentor;

/**
 * Opens a mentor link: a colleague link marked `mentor` that ends 30 days from now. Two people already linked in
 * person keep that link: it never expires, and a mentor link must not shorten it.
 */
export async function openMentorLink(
  m: MentorContext,
  open: { user: UserId; card: ColleagueCard; channel: EngagementId; side: MentorSide },
): Promise<void> {
  const now = m.c.ctx.clock.now();
  await m.c.store.update(open.user, (old) => {
    if (old?.state === ColleagueState.linked && !isMentorLink(old) && !isExpired(old, now)) return undefined;
    const link: ColleagueRecord = {
      user: open.user,
      card: open.card,
      channel: open.channel,
      state: ColleagueState.linked,
      linked_at: now.toISOString(),
      unread: old?.unread ?? 0,
      kind: LinkKind.enum.mentor,
      expires_at: mentorExpiry(now),
      mentor: open.side,
    };
    return link;
  });
}

/** Moves a live mentor link's end to 30 days from now, on this phone and on theirs. */
export async function renew(m: MentorContext, user: UserId): Promise<Colleague> {
  const now = m.c.ctx.clock.now();
  const old = await m.c.store.get(user);
  if (!old || !isMentorLink(old) || old.state !== ColleagueState.linked) throw new MentorError(MentorRefusal.notLinked);
  if (isExpired(old, now)) throw new MentorError(MentorRefusal.expired);
  await mustReach(m, user);
  const expires_at = mentorExpiry(now);
  const step: ColleagueLink = { step: LinkStep.enum.renew, expires_at };
  await m.c.transport.send(user, old.channel, K.colleague, step);
  const next = await m.c.store.update(user, (c) => c && { ...c, expires_at });
  return next ?? old;
}

/** Forgets mentor links that have run out, on this phone only (theirs does the same), and returns the rest. */
export async function sweepExpired(store: ColleagueStore, now: Date): Promise<ColleagueRecord[]> {
  const all = await store.list();
  const ended = all.filter((c) => isExpired(c, now));
  await Promise.all(ended.map((c) => store.remove(c.user)));
  return all.filter((c) => !isExpired(c, now));
}
