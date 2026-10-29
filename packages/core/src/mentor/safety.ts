import { MentorReply, type ReportReason, type UserId } from "@gigsync/protocol";
import * as links from "../colleague/link.js";
import { apiOf, type MentorContext } from "./context.js";
import { isOpenRequest, withdraw } from "./request.js";
import { RequestState } from "./types.js";

/**
 * Blocks someone: hidden everywhere on this phone at once (their link ends, open requests to them close, their
 * requests and introductions go), then the server is told never to match the two again. The phone's part stands
 * even when the server cannot be reached; blocking again tells it later.
 */
export async function block(m: MentorContext, user: UserId): Promise<void> {
  const now = m.c.ctx.clock.now();
  await m.store.block(user, now);
  if (await m.c.store.get(user)) await links.unlink(m.c, user);
  const [sent, received, intros] = await Promise.all([m.store.sent(), m.store.received(), m.store.intros()]);
  for (const r of sent.filter((r) => r.mentor === user && isOpenRequest(r))) await withdraw(m, r);
  for (const r of received.filter((r) => r.from === user && isOpenRequest(r)))
    await m.store.saveReceived({ ...r, state: RequestState.closed });
  for (const i of intros.filter((i) => i.other === user && i.mine === undefined))
    await m.store.updateIntro(i.channel, (old) => old && { ...old, mine: MentorReply.enum.decline });
  await apiOf(m).blockMentor(user);
}

/** Reports someone to GigSync with one of the fixed reasons; no words of anyone's travel with it. */
export async function report(m: MentorContext, user: UserId, reason: ReportReason): Promise<void> {
  await apiOf(m).reportMentor({ user, reason });
}
