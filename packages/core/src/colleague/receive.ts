import {
  type ColleagueLink,
  type ColleagueNote,
  type EngagementId,
  type Envelope,
  EnvelopeKind,
  LinkStep,
} from "@gigsync/protocol";
import { log } from "../log.js";
import type { Received } from "../mail/transport.js";
import type { ColleagueContext } from "./store.js";
import { ColleagueState, NoteFrom } from "./types.js";

const K = EnvelopeKind.enum;
const S = LinkStep.enum;

/**
 * The later of two channels. When two workers scan each other at once both asks link, on two channels; each phone
 * keeps the later one (ULIDs sort by time), so both end up on the same channel.
 */
const later = (a: EngagementId, b: EngagementId) => (a > b ? a : b);

function dropped(e: Envelope, reason: string): void {
  log.warn("colleague envelope dropped", { messageId: e.id, kind: e.kind, reason });
}

/**
 * Takes one colleague envelope. Anything that does not fit a link this phone has, or a code it showed, is dropped
 * without a reply and without storing anything, so probing a phone learns nothing.
 */
export async function receive(c: ColleagueContext, { envelope: e, body }: Received): Promise<void> {
  if (e.kind === K.colleague_note) return onNote(c, e, body as ColleagueNote);
  const link = body as ColleagueLink;
  switch (link.step) {
    case S.ask:
      return onAsk(c, e, link);
    case S.ok:
      return onOk(c, e, link);
    case S.end:
      return onEnd(c, e);
  }
}

/** They scanned this phone's code: with a live, unused code the two are linked, and this phone answers with its card. */
async function onAsk(c: ColleagueContext, e: Envelope, ask: ColleagueLink): Promise<void> {
  const { code: shown, card } = ask;
  const now = c.ctx.clock.now();
  const code = shown && card ? await c.store.takeCode(shown, now) : undefined;
  if (!code || !card) return dropped(e, "no live code");
  await c.store.update(e.from.user, (old) => {
    // This phone may have asked them too; that ask's `ok` can still arrive and must be recognised.
    const asking = old?.state === ColleagueState.asked ? old.channel : old?.asking;
    return {
      user: e.from.user,
      card,
      channel: old?.state === ColleagueState.linked ? later(old.channel, e.engagement) : e.engagement,
      state: ColleagueState.linked,
      linked_at: old?.linked_at ?? now.toISOString(),
      unread: old?.unread ?? 0,
      ...(asking ? { asking } : {}),
    };
  });
  const ok: ColleagueLink = { step: S.ok, card: code.card };
  await c.transport.send(e.from.user, e.engagement, K.colleague, ok);
}

/** The phone this one asked said yes, with its owner's card. */
async function onOk(c: ColleagueContext, e: Envelope, ok: ColleagueLink): Promise<void> {
  const card = ok.card;
  const at = c.ctx.clock.now().toISOString();
  const next = await c.store.update(e.from.user, (old) => {
    if (!card || !old) return undefined;
    if (old.state === ColleagueState.asked && old.channel === e.engagement)
      return { ...old, card, state: ColleagueState.linked, linked_at: at };
    if (old.asking !== e.engagement) return undefined;
    const { asking: _answered, ...rest } = old;
    return { ...rest, card, channel: later(old.channel, e.engagement) };
  });
  if (!next) dropped(e, "not asked");
}

/** They ended the link: forget them and the notes, on whichever of the pair's channels it came. */
async function onEnd(c: ColleagueContext, e: Envelope): Promise<void> {
  const old = await c.store.get(e.from.user);
  if (!old || (old.channel !== e.engagement && old.asking !== e.engagement)) return dropped(e, "no link");
  await c.store.remove(e.from.user);
}

/** A note counts only from a linked colleague, on the pair's channel. */
async function onNote(c: ColleagueContext, e: Envelope, note: ColleagueNote): Promise<void> {
  const old = await c.store.get(e.from.user);
  if (old?.state !== ColleagueState.linked || old.channel !== e.engagement) return dropped(e, "not linked");
  // Their clock may run ahead; a note is never placed later than the moment it arrived.
  const now = c.ctx.clock.now().getTime();
  const at = new Date(Math.min(Date.parse(e.sent_at), now)).toISOString();
  await c.store.addNote(e.from.user, { id: e.id, from: NoteFrom.them, text: note.text, lang: note.lang, at });
}
