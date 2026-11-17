import { log } from "@gigsync/core/log";
import { verify } from "@gigsync/crypto";
import {
  ClaimRequest,
  Envelope,
  EnvelopeKind,
  MAX_CIPHERTEXT_CHARS,
  MessageId,
  QR_KINDS,
  signingBytes,
  UserId,
} from "@gigsync/protocol";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { ApiError, type AppEnv, USER_PARAM, Var } from "../context.js";
import { activeDeviceIds, deviceSigningKey, pushAddresses } from "../db/devices.js";
import { offerTaken } from "../db/qr-offers.js";
import { mayRequest, noteRequest } from "../db/request-log.js";
import { recordFallbackCity } from "../live-cities.js";
import { sendersOf, wakeAll } from "../push/alerts.js";
import { WAKE_KINDS } from "../push/webpush.js";
import { OFFER_SEND_MS } from "../qr/rules.js";
import { noteDeliveredAgree } from "../records/one-sided.js";

/** Largest batch one ack may clear. */
const MAX_ACK = 500;
/** Room for an envelope's header, signature and up to ten wrapped keys around its ciphertext, in bytes. */
const ENVELOPE_OVERHEAD_BYTES = 16 * 1024;

/** Refuses an oversized envelope before reading it, not after parsing it. */
const envelopeLimit = bodyLimit({
  maxSize: MAX_CIPHERTEXT_CHARS + ENVELOPE_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: ApiError.tooLarge }, 413),
});

/** Mailbox and inbox, behind the session middleware. The server routes sealed envelopes; it never reads them. */
export const mail = new Hono<AppEnv>();

// ── Deliver to someone else's mailbox ────────────────────────────────────────────────────────────────────────────
mail.post(`/mailbox/:${USER_PARAM}`, envelopeLimit, async (c) => {
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
  // A household asks at most MAX_REQUESTS_PER_DAY workers in a day; which need each request is for stays sealed.
  const asking = e.kind === EnvelopeKind.enum.request;
  if (asking && !(await mayRequest(db, e.from.user, e.id))) {
    log.warn("requests over the day's cap", { requestId: c.get(Var.requestId), from: e.from.user });
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  }
  if (devices.length === 0) {
    log.info("delivery to unknown user", { requestId: c.get(Var.requestId), to: to.data });
    return c.json({ error: ApiError.recipientNotFound }, 404);
  }
  // Only the devices it was sealed for get a copy: a device added since the sender looked could not open it anyway.
  const sealed = devices.filter((d) => Object.hasOwn(e.keys, d));
  if (sealed.length === 0) {
    log.warn("envelope sealed to no current device", { requestId: c.get(Var.requestId), messageId: e.id });
    return c.json({ error: ApiError.noSealedDevice }, 409);
  }
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(to.data));
  const out = await box.deliver({ envelope: e, devices: sealed });
  if (asking) await noteRequest(db, e.from.user, e.id);
  await noteDeliveredAgree(db, e, c.get(Var.requestId), recordFallbackCity(c.env));
  log.info("envelope delivered", {
    requestId: c.get(Var.requestId),
    messageId: e.id,
    kind: e.kind,
    from: e.from.user,
    to: to.data,
    stored: out.stored,
    devices: out.devices,
  });
  // News a person wants even with the app closed reaches their phones: a browser as a push saying what came and from
  // whom, encrypted to it (push/webpush.ts), the Android app as a plain "something new" (push/fcm.ts). The addresses
  // are read now, while the request's database connection is open; the pushes go after the answer.
  const senders = sendersOf(c.env);
  if (senders && out.stored && WAKE_KINDS.has(e.kind)) {
    const addresses = await pushAddresses(db, to.data);
    const news = { kind: e.kind, from: e.from.user };
    if (addresses.length > 0)
      c.executionCtx.waitUntil(wakeAll(addresses, news, senders, new Date(), c.get(Var.requestId)));
  }
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

// ── One agent per job (ADR 0045): the first of my devices to claim an engagement answers it ──────────────────────
mail.post("/inbox/claims", async (c) => {
  const body = ClaimRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const { engagement } = body.data;
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get(Var.user)));
  const owner = await box.claim(engagement, c.get(Var.device));
  log.info("engagement claimed", {
    requestId: c.get(Var.requestId),
    engagement,
    device: c.get(Var.device),
    won: owner === c.get(Var.device),
  });
  return c.json({ engagement, owner });
});
