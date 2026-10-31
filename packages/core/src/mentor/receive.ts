import {
  COLLEAGUE_KINDS,
  type EngagementId,
  type Envelope,
  EnvelopeKind,
  type Introduce,
  type LandingRequest,
  type MentorAccept,
  type MentorOffer,
  MentorReply,
  MentorRole,
  type UserId,
} from "@gigsync/protocol";
import { log } from "../log.js";
import type { Received } from "../mail/transport.js";
import type { MentorContext } from "./context.js";
import { onIntroAnswer, onIntroduce } from "./intro.js";
import { openMentorLink } from "./link.js";
import { receiveOnLink } from "./link-receive.js";
import { refreshSlots } from "./listing.js";
import { RequestState } from "./types.js";

const K = EnvelopeKind.enum;
const R = MentorReply.enum;
const S = RequestState;

function dropped(e: Envelope, reason: string): void {
  log.warn("mentor envelope dropped", { messageId: e.id, kind: e.kind, reason });
}

/**
 * Takes one mentor envelope, or one on a mentor link (a note, a renewal, the end). Anything from someone blocked
 * here, or that fits no request, introduction or link this phone has, is dropped without a reply.
 */
export async function receive(m: MentorContext, { envelope: e, body }: Received): Promise<void> {
  const from = e.from.user;
  // Someone this owner blocked is hidden everywhere: nothing they send is kept.
  if (await m.store.isBlocked(from)) return dropped(e, "blocked");
  if (COLLEAGUE_KINDS.has(e.kind)) return receiveOnLink(m, e, body);
  switch (e.kind) {
    case K.introduce:
      if (!(await onIntroduce(m, from, e.engagement, body as Introduce))) dropped(e, "not from someone known");
      return;
    case K.landing_request:
      return onLanding(m, e, body as LandingRequest);
    case K.mentor_offer:
      return onOffer(m, e, body as MentorOffer);
    case K.mentor_accept:
      return onAccept(m, from, e.engagement, (body as MentorAccept).reply);
    default:
      return dropped(e, "not a mentor kind");
  }
}

/** A newcomer asks this owner for help: kept as a decision for Today, once per channel. */
async function onLanding(m: MentorContext, e: Envelope, request: LandingRequest): Promise<void> {
  if (await m.store.receivedOn(e.engagement)) return dropped(e, "already asked");
  const at = m.ctx.clock.now().toISOString();
  await m.store.saveReceived({ channel: e.engagement, from: e.from.user, request, state: S.sent, at });
}

/** A mentor answered one of this newcomer's requests: an offer to confirm, or a no. */
async function onOffer(m: MentorContext, e: Envelope, o: MentorOffer): Promise<void> {
  const r = await m.store.sentOn(e.engagement);
  if (r?.mentor !== e.from.user || r.state !== S.sent) return dropped(e, "no open request");
  if (o.reply === R.accept && o.card)
    return m.store.saveSent({ ...r, state: S.offered, card: o.card, ...(o.note ? { note: o.note } : {}) });
  await m.store.saveSent({ ...r, state: S.declined });
}

/**
 * The newcomer's answer to this mentor's offer (yes opens the link here too; withdraw closes it), or one side's
 * answer to an introduction.
 */
async function onAccept(m: MentorContext, from: UserId, channel: EngagementId, reply: MentorReply): Promise<void> {
  const r = await m.store.receivedOn(channel);
  if (!r) return onIntroAnswer(m, from, channel, reply);
  if (r.from !== from) return;
  if (reply === R.accept && r.state === S.offered) {
    const side = { role: MentorRole.enum.mentor };
    await openMentorLink(m, { user: from, card: r.request.card, channel, side });
    await m.store.saveReceived({ ...r, state: S.linked });
    // A listing's open slots follow the newcomers being helped; a failure here only leaves the old count up.
    await refreshSlots(m).catch((err: unknown) =>
      log.warn("mentor slots not updated", { error: err instanceof Error ? err.message : String(err) }),
    );
    return;
  }
  if (reply === R.withdraw && (r.state === S.sent || r.state === S.offered))
    await m.store.saveReceived({ ...r, state: S.closed });
}
