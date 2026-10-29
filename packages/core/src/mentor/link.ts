import {
  type ColleagueCard,
  type ColleagueLink,
  ColleagueNote,
  type EngagementId,
  EnvelopeKind,
  type Lang,
  LinkKind,
  LinkStep,
  type UserId,
} from "@gigsync/protocol";
import { type MentorContext, mustReach } from "./context.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { isExpired, mentorExpiry } from "./expiry.js";
import { isMentorLink, type LinkStore } from "./link-store.js";
import { type MentorLink, type MentorSide, NoteFrom } from "./types.js";

const K = EnvelopeKind.enum;

/** A mentor link this phone has and that has not run out. */
const live = (l: MentorLink | undefined, now: Date): l is MentorLink => !!l && isMentorLink(l) && !isExpired(l, now);

/** Opens a mentor link that ends 30 days from now, in place of any link this phone had with them before. */
export async function openMentorLink(
  m: MentorContext,
  open: { user: UserId; card: ColleagueCard; channel: EngagementId; side: MentorSide },
): Promise<void> {
  const now = m.ctx.clock.now();
  await m.links.update(open.user, (old) => ({
    user: open.user,
    card: open.card,
    channel: open.channel,
    linked_at: now.toISOString(),
    unread: old?.unread ?? 0,
    kind: LinkKind.enum.mentor,
    expires_at: mentorExpiry(now),
    mentor: open.side,
  }));
}

/** Moves a live mentor link's end to 30 days from now, on this phone and on theirs. */
export async function renew(m: MentorContext, user: UserId): Promise<MentorLink> {
  const now = m.ctx.clock.now();
  const old = await m.links.get(user);
  if (!old || !isMentorLink(old)) throw new MentorError(MentorRefusal.notLinked);
  if (isExpired(old, now)) throw new MentorError(MentorRefusal.expired);
  await mustReach(m, user);
  const expires_at = mentorExpiry(now);
  const step: ColleagueLink = { step: LinkStep.enum.renew, expires_at };
  await m.transport.send(user, old.channel, K.colleague, step);
  const next = await m.links.update(user, (l) => l && { ...l, expires_at });
  return next ?? old;
}

/** A note on a live mentor link, kept on this phone in the language it was written in. */
export async function sendNote(m: MentorContext, user: UserId, text: string, lang: Lang): Promise<void> {
  const link = await m.links.get(user);
  if (!live(link, m.ctx.clock.now())) throw new MentorError(MentorRefusal.notLinked);
  const note = ColleagueNote.parse({ text: text.trim(), lang });
  const e = await m.transport.send(user, link.channel, K.colleague_note, note);
  await m.links.addNote(user, { id: e.id, from: NoteFrom.me, text: note.text, lang: note.lang, at: e.sent_at });
}

/** Ends a link: tells their phone, and forgets the link and its notes here (remembering whom it was with). */
export async function endLink(m: MentorContext, user: UserId): Promise<void> {
  const existing = await m.links.get(user);
  if (!existing) return;
  const end: ColleagueLink = { step: LinkStep.enum.end };
  await m.transport.send(user, existing.channel, K.colleague, end);
  await m.links.remove(user, m.ctx.clock.now());
}

/**
 * Ends, on this phone only (theirs does the same), mentor links that have run out and any link an older build made
 * in person, and returns the live mentor links.
 */
export async function sweepExpired(store: LinkStore, now: Date): Promise<MentorLink[]> {
  const all = await store.list();
  const kept = all.filter((l) => live(l, now));
  const ended = all.filter((l) => !kept.includes(l));
  await Promise.all(ended.map((l) => store.remove(l.user, now)));
  return kept;
}
