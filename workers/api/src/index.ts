import { BEARER_PREFIX, Header, HttpMethod } from "@gigsync/core/http";
import { log, pii } from "@gigsync/core/log";
import { UserId } from "@gigsync/protocol";
import { Mailbox } from "@gigsync/worker-mailbox";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";
import { ApiError, type AppEnv, USER_PARAM, V1, V1_AUTH, Var } from "./context.js";
import { openDirectory } from "./db/client.js";
import { activeDevices } from "./db/devices.js";
import { sessionOwner } from "./db/sessions.js";
import type { Env } from "./env.js";
import { requestLog } from "./log.js";
import { auth } from "./routes/auth.js";
import { board } from "./routes/board.js";
import { content } from "./routes/content.js";
import { devices } from "./routes/devices.js";
import { estimates } from "./routes/estimates.js";
import { mail } from "./routes/mail.js";
import { mentors } from "./routes/mentors.js";
import { qr } from "./routes/qr.js";

export type { Env };
export { Mailbox };

const app = new Hono<AppEnv>();

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
    allowMethods: [HttpMethod.get, HttpMethod.post, HttpMethod.put, HttpMethod.delete, HttpMethod.options],
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

// ── One directory connection per /v1 request, before anything that queries it ─────────────────────────────────────
app.use(`${V1}/*`, openDirectory);

// ── Sign-in (OTP), before the session middleware ─────────────────────────────────────────────────────────────────
app.route(V1_AUTH, auth);

// ── Auth middleware for everything below ──────────────────────────────────────────────────────────────────────────
app.use(`${V1}/*`, async (c, next) => {
  if (c.req.path.startsWith(`${V1_AUTH}/`)) return next();
  const header = c.req.header(Header.authorization);
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
  if (!token) return c.json({ error: ApiError.unauthorized }, 401);
  const row = await sessionOwner(c.get(Var.db), token);
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
  const devices = await activeDevices(c.get(Var.db), user.data);
  if (devices.length === 0) return c.json({ error: ApiError.notFound }, 404);
  return c.json({ user: user.data, devices });
});

// ── Mailbox, inbox, the job board, mentors, city guides, rate estimates and personal QR codes ─────────────────────
app.route(V1, mail);
app.route(`${V1}/board`, board);
app.route(`${V1}/mentors`, mentors);
app.route(`${V1}/content`, content);
app.route(`${V1}/devices`, devices);
app.route(`${V1}/estimates`, estimates);
app.route(`${V1}/qr`, qr);

app.notFound((c) => c.json({ error: ApiError.notFound }, 404));

export default app;
