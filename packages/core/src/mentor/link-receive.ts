import { type ColleagueLink, type ColleagueNote, type Envelope, EnvelopeKind, LinkStep } from "@gigsync/protocol";
import { log } from "../log.js";
import { bothSigned } from "../payments/passbook.js";
import type { MentorContext } from "./context.js";
import { isExpired, renewedExpiry } from "./expiry.js";
import { isMentorLink } from "./link-store.js";
import { NoteFrom } from "./types.js";

const K = EnvelopeKind.enum;
const S = LinkStep.enum;

function dropped(e: Envelope, reason: string): void {
  log.warn("link envelope dropped", { messageId: e.id, kind: e.kind, reason });
}

/**
 * Takes one envelope on a mentor link: a note, a renewal or the end. Asks to link in person (`ask`, `ok`) come only
 * from older builds and are dropped, as is anything that fits no link here: no reply, nothing stored, so probing a
 * phone learns nothing.
 */
export async function receiveOnLink(m: MentorContext, e: Envelope, body: unknown): Promise<void> {
  if (e.kind === K.colleague_note) return onNote(m, e, body as ColleagueNote);
  const step = body as ColleagueLink;
  switch (step.step) {
    case S.end:
      return onEnd(m, e);
    case S.renew:
      return onRenew(m, e, step);
    default:
      return dropped(e, "linking in person is gone");
  }
}

/** They ended the link: forget it and its notes here too. */
async function onEnd(m: MentorContext, e: Envelope): Promise<void> {
  const old = await m.links.get(e.from.user);
  if (old?.channel !== e.engagement) return dropped(e, "no link");
  await m.links.remove(e.from.user, m.ctx.clock.now());
}

/**
 * They renewed a live mentor link. Its end moves forward, never back, and never past a full term from now on this
 * phone's clock, whatever theirs says.
 */
async function onRenew(m: MentorContext, e: Envelope, renew: ColleagueLink): Promise<void> {
  const now = m.ctx.clock.now();
  const proposed = renew.expires_at;
  const next = await m.links.update(e.from.user, (old) => {
    const live = old && isMentorLink(old) && old.channel === e.engagement && !isExpired(old, now);
    return live && proposed ? { ...old, expires_at: renewedExpiry(old.expires_at, proposed, now) } : undefined;
  });
  if (!next) dropped(e, "no live mentor link");
}

/**
 * A note counts on a live mentor link, on the pair's channel. One on the channel of a job both sides signed is the
 * other side asking whether this owner knows someone in a city: it is kept with that job's notes, where the owner
 * reads it beside "Introduce … to someone".
 */
async function onNote(m: MentorContext, e: Envelope, note: ColleagueNote): Promise<void> {
  const link = await m.links.get(e.from.user);
  if (link && link.channel === e.engagement) {
    if (!isMentorLink(link) || isExpired(link, m.ctx.clock.now())) return dropped(e, "mentor link ended");
    // Their clock may run ahead; a note is never placed later than the moment it arrived.
    const now = m.ctx.clock.now().getTime();
    const at = new Date(Math.min(Date.parse(e.sent_at), now)).toISOString();
    return m.links.addNote(e.from.user, { id: e.id, from: NoteFrom.them, text: note.text, lang: note.lang, at });
  }
  const job = await m.ctx.store.job(e.engagement);
  if (job?.engagement.counterpart !== e.from.user || !bothSigned(job)) return dropped(e, "no link or signed job");
  await m.ctx.store.saveJob({ ...job, notes: [...(job.notes ?? []), { text: note.text, lang: note.lang }] });
}
