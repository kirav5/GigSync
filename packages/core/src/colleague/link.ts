import {
  COLLEAGUE_PROTOCOL,
  ColleagueCard,
  type ColleagueLink,
  ColleagueNote,
  type EngagementId,
  EnvelopeKind,
  inviteText,
  type Lang,
  LINK_CODE_TTL_MS,
  LinkStep,
  parseInvite,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import type { Relay } from "../net/api.js";
import { everyDeviceSpeaks } from "../net/reach.js";
import { newLinkCode } from "./code.js";
import { ColleagueError, ColleagueRefusal } from "./errors.js";
import { type ColleagueContext, type ColleagueRecord, publicView } from "./store.js";
import { type Colleague, ColleagueState, NoteFrom } from "./types.js";

const K = EnvelopeKind.enum;
const S = LinkStep.enum;

/** True when `user` has a phone signed in and every one of their phones understands colleague envelopes. */
export const canReach = (relay: Relay, user: UserId): Promise<boolean> =>
  everyDeviceSpeaks(relay, user, COLLEAGUE_PROTOCOL);

/** A fresh single-use code for this phone's colleague QR, as the QR text that carries it with the owner's name. */
export async function invite(c: ColleagueContext, card: ColleagueCard): Promise<string> {
  const mine = ColleagueCard.parse(card);
  const now = c.ctx.clock.now();
  const code = newLinkCode();
  const expires_at = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString();
  await c.store.addCode({ code, card: mine, expires_at }, now);
  return inviteText({ u: c.ctx.me.user, c: code, n: mine.name });
}

/**
 * Asks the phone that showed `payload` to link. A colleague already linked stays as it is. An ask still waiting is
 * replaced on a fresh channel, so a code that ran out before it reached them never blocks the next try.
 */
export async function link(c: ColleagueContext, payload: string, card: ColleagueCard): Promise<Colleague> {
  const inv = parseInvite(payload.trim());
  if (!inv) throw new ColleagueError(ColleagueRefusal.badCode);
  if (inv.u === c.ctx.me.user) throw new ColleagueError(ColleagueRefusal.ownCode);
  const mine = ColleagueCard.parse(card);
  const existing = await c.store.get(inv.u);
  if (existing?.state === ColleagueState.linked) return publicView(existing);
  if (!(await canReach(c.relay, inv.u))) throw new ColleagueError(ColleagueRefusal.tooOld);
  const channel = `eng_${ulid(c.ctx.clock.now().getTime())}` as EngagementId;
  const ask: ColleagueLink = { step: S.ask, code: inv.c, card: mine };
  await c.transport.send(inv.u, channel, K.colleague, ask);
  // Until their `ok` brings their card, all this phone knows of them is the name their code showed.
  const asked: ColleagueRecord = {
    user: inv.u,
    card: { name: inv.n, trades: [], languages: [] },
    channel,
    state: ColleagueState.asked,
    unread: existing?.unread ?? 0,
  };
  await c.store.update(inv.u, () => asked);
  return publicView(asked);
}

/** A note to a linked colleague, kept on this phone in the language it was written in. */
export async function send(c: ColleagueContext, user: UserId, text: string, lang: Lang): Promise<void> {
  const linked = await c.store.get(user);
  if (linked?.state !== ColleagueState.linked) throw new ColleagueError(ColleagueRefusal.notLinked);
  const note = ColleagueNote.parse({ text: text.trim(), lang });
  const e = await c.transport.send(user, linked.channel, K.colleague_note, note);
  await c.store.addNote(user, { id: e.id, from: NoteFrom.me, text: note.text, lang: note.lang, at: e.sent_at });
}

/** Ends the link: tells their phone (on every channel the pair may be using) and forgets them and the notes here. */
export async function unlink(c: ColleagueContext, user: UserId): Promise<void> {
  const existing = await c.store.get(user);
  if (!existing) return;
  const end: ColleagueLink = { step: S.end };
  for (const channel of [existing.channel, existing.asking]) {
    if (channel) await c.transport.send(user, channel, K.colleague, end);
  }
  await c.store.remove(user);
}
