import { BEARER_PREFIX, Header, HttpMethod } from "@collab/core/http";
import { log, pii } from "@collab/core/log";
import { type DeviceId, Envelope, MessageId, UserId } from "@collab/protocol";
import { Mailbox } from "@collab/worker-mailbox";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";
import { z } from "zod";
import { ApiError, type AppEnv, V1, V1_AUTH, Var } from "./context.js";
import type { Env } from "./env.js";
import { requestLog } from "./log.js";
import { auth } from "./routes/auth.js";

export type { Env };
export { Mailbox };

const app = new Hono<AppEnv>();
/** Path parameter naming the user a directory or mailbox route is about. */
const USER_PARAM = "user";

app.use("*", requestLog());

const ORIGIN_SEPARATOR = ",";

// ── CORS: only the origins in ALLOWED_ORIGINS. Auth is a bearer token, never a cookie, so no credentials mode. ──────
app.use("*", (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(ORIGIN_SEPARATOR)
    .map((o) => o.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: [HttpMethod.get, HttpMethod.post, HttpMethod.options],
    allowHeaders: [Header.contentType, Header.authorization],
    maxAge: 86400,
  })(c, next);
});

// One place for the unexpected: log what failed, never the request (it may hold phone numbers, keys or content).
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  log.error("unhandled", {
    requestId: c.get(Var.requestId),
    route: routePath(c),
    method: c.req.method,
    error: err.name,
    message: err.message,
  });
  return c.json({ error: ApiError.internal }, 500);
});

app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, protocol: 1 }));

// ── Sign-in (OTP), before the session middleware ─────────────────────────────────────────────────────────────────
app.route(V1_AUTH, auth);

// ── Auth middleware for everything below ──────────────────────────────────────────────────────────────────────────
app.use(`${V1}/*`, async (c, next) => {
  if (c.req.path.startsWith(`${V1_AUTH}/`)) return next();
  const header = c.req.header(Header.authorization);
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
  if (!token) return c.json({ error: ApiError.unauthorized }, 401);
  const row = await c.env.DIRECTORY.prepare(
    "SELECT user_id, device_id FROM sessions WHERE token = ? AND revoked_at IS NULL",
  )
    .bind(token)
    .first<{ user_id: UserId; device_id: DeviceId }>();
  if (!row) {
    log.warn("session rejected", { requestId: c.get(Var.requestId), token: pii(token) });
    return c.json({ error: ApiError.unauthorized }, 401);
  }
  c.set(Var.user, row.user_id);
  c.set(Var.device, row.device_id);
  await next();
});

// ── Directory ─────────────────────────────────────────────────────────────────────────────────────────────────────
app.get(`${V1}/directory/:${USER_PARAM}`, async (c) => {
  const user = UserId.safeParse(c.req.param(USER_PARAM));
  if (!user.success) return c.json({ error: ApiError.badUserId }, 400);
  const { results } = await c.env.DIRECTORY.prepare(
    "SELECT device_id, signing_key, encryption_key, protocol FROM devices WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(user.data)
    .all();
  if (results.length === 0) return c.json({ error: ApiError.notFound }, 404);
  return c.json({ user: user.data, devices: results });
});

// ── Deliver to someone else's mailbox ────────────────────────────────────────────────────────────────────────────────────────────────
app.post(`${V1}/mailbox/:${USER_PARAM}`, async (c) => {
  const to = UserId.safeParse(c.req.param(USER_PARAM));
  const env = Envelope.safeParse(await c.req.json().catch(() => null));
  if (!to.success || !env.success) return c.json({ error: ApiError.badEnvelope }, 400);
  if (env.data.to.user !== to.data || env.data.from.user !== c.get(Var.user))
    return c.json({ error: ApiError.envelopeMismatch }, 403);
  // TODO(M2): verify `sig` against the sender device's signing key from the directory before accepting.
  const { results } = await c.env.DIRECTORY.prepare(
    "SELECT device_id FROM devices WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(to.data)
    .all<{ device_id: DeviceId }>();
  if (results.length === 0) {
    log.info("delivery to unknown user", { requestId: c.get(Var.requestId), to: to.data });
    return c.json({ error: ApiError.recipientNotFound }, 404);
  }
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(to.data));
  const out = await box.deliver({ envelope: env.data, devices: results.map((r) => r.device_id) });
  log.info("envelope delivered", {
    requestId: c.get(Var.requestId),
    messageId: env.data.id,
    from: env.data.from.user,
    to: to.data,
    stored: out.stored,
    devices: out.devices,
  });
  // TODO(M2): if no device has an open socket, enqueue an FCM wake-up on the Queue.
  return c.json(out, out.stored ? 201 : 200);
});

// ── My inbox: what the mailbox holds for this device ──────────────────────────────────────────────────────────────
app.get(`${V1}/inbox`, async (c) => {
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get(Var.user)));
  const envelopes = await box.fetchFor(c.get(Var.device));
  log.info("inbox fetched", { requestId: c.get(Var.requestId), device: c.get(Var.device), count: envelopes.length });
  return c.json(envelopes);
});

app.post(`${V1}/inbox/ack`, async (c) => {
  const body = z.object({ ids: z.array(MessageId).min(1).max(500) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get(Var.user)));
  const acked = await box.ack(c.get(Var.device), body.data.ids);
  log.info("inbox acked", { requestId: c.get(Var.requestId), device: c.get(Var.device), acked });
  return c.json({ acked });
});

app.notFound((c) => c.json({ error: ApiError.notFound }, 404));

export default app;
