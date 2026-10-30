import { log } from "@gigsync/core/log";
import { verify } from "@gigsync/crypto";
import { Envelope, MessageId, QR_KINDS, signingBytes, UserId } from "@gigsync/protocol";
import { Hono } from "hono";
import { z } from "zod";
import { ApiError, type AppEnv, USER_PARAM, Var } from "../context.js";
import { activeDeviceIds, deviceSigningKey } from "../db/devices.js";
import { offerTaken } from "../db/qr-offers.js";
import { OFFER_SEND_MS } from "../qr/rules.js";
import { countForRecord } from "../record/count.js";

/** Largest batch one ack may clear. */
const MAX_ACK = 500;

/** Mailbox and inbox, behind the session middleware. The server routes sealed envelopes; it never reads them. */
export const mail = new Hono<AppEnv>();

// ── Deliver to someone else's mailbox ────────────────────────────────────────────────────────────────────────────
mail.post(`/mailbox/:${USER_PARAM}`, async (c) => {
  const to = UserId.safeParse(c.req.param(USER_PARAM));
  const env = Envelope.safeParse(await c.req.json().catch(() => null));
  if (!to.success || !env.success) return c.json({ error: ApiError.badEnvelope }, 400);
  const e = env.data;
  // Sent by this session's own device, to the mailbox it names.
  if (e.to.user !== to.data || e.from.user !== c.get(Var.user) || e.from.device !== c.get(Var.device))
    return c.json({ error: ApiError.envelopeMismatch }, 403);
  const db = c.get(Var.db);
  const [signingKey, devices] = await Promise.all([
    deviceSigningKey(db, e.from.user, e.from.device),
    activeDeviceIds(db, to.data),
  ]);
  if (!signingKey || !verify(signingBytes(e), e.sig, signingKey)) {
    log.warn("envelope signature rejected", { requestId: c.get(Var.requestId), messageId: e.id, from: e.from.user });
    return c.json({ error: ApiError.badSignature }, 403);
  }
  // An offer to work goes only to a household whose live QR the sender just offered through (routes/qr.ts).
  const since = new Date(Date.now() - OFFER_SEND_MS);
  if (QR_KINDS.has(e.kind) && !(await offerTaken(db, e.from.user, to.data, since))) {
    log.warn("work offer without a taken offer", { requestId: c.get(Var.requestId), messageId: e.id });
    return c.json({ error: ApiError.offerNotTaken }, 403);
  }
  if (devices.length === 0) {
    log.info("delivery to unknown user", { requestId: c.get(Var.requestId), to: to.data });
    return c.json({ error: ApiError.recipientNotFound }, 404);
  }
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(to.data));
  const out = await box.deliver({ envelope: e, devices });
  await countForRecord(db, e, c.get(Var.requestId));
  log.info("envelope delivered", {
    requestId: c.get(Var.requestId),
    messageId: e.id,
    kind: e.kind,
    from: e.from.user,
    to: to.data,
    stored: out.stored,
    devices: out.devices,
  });
  // TODO(M2): if no device has an open socket, enqueue an FCM wake-up on the Queue.
  return c.json(out, out.stored ? 201 : 200);
});

// ── My inbox: what the mailbox holds for this device ──────────────────────────────────────────────────────────────
mail.get("/inbox", async (c) => {
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get(Var.user)));
  const envelopes = await box.fetchFor(c.get(Var.device));
  log.info("inbox fetched", { requestId: c.get(Var.requestId), device: c.get(Var.device), count: envelopes.length });
  return c.json(envelopes);
});

mail.post("/inbox/ack", async (c) => {
  const body = z
    .object({ ids: z.array(MessageId).min(1).max(MAX_ACK) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get(Var.user)));
  const acked = await box.ack(c.get(Var.device), body.data.ids);
  log.info("inbox acked", { requestId: c.get(Var.requestId), device: c.get(Var.device), acked });
  return c.json({ acked });
});
