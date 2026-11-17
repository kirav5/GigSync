import { Header, HttpMethod } from "@gigsync/core/http";
import { log } from "@gigsync/core/log";
import { UserId } from "@gigsync/protocol";
import { Mailbox } from "@gigsync/worker-mailbox";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";
import { ApiError, type AppEnv, USER_PARAM, V1, V1_AUTH, Var } from "./context.js";
import { openDirectory } from "./db/client.js";
import { activeDevices } from "./db/devices.js";
import type { Env } from "./env.js";
import { requestLog } from "./log.js";
import { requireSession } from "./middleware/session.js";
import { admin } from "./routes/admin.js";
import { auth } from "./routes/auth.js";
import { board } from "./routes/board.js";
import { cities } from "./routes/cities.js";
import { consent } from "./routes/consent.js";
import { content } from "./routes/content.js";
import { devices } from "./routes/devices.js";
import { estimates } from "./routes/estimates.js";
import { find } from "./routes/find.js";
import { geo } from "./routes/geo.js";
import { jobMoney } from "./routes/job-money.js";
import { jobRecords } from "./routes/job-records.js";
import { mail } from "./routes/mail.js";
import { map } from "./routes/map.js";
import { me } from "./routes/me.js";
import { mentors } from "./routes/mentors.js";
import { model } from "./routes/model.js";
import { phoneConfirm } from "./routes/phone-confirm.js";
import { qr } from "./routes/qr.js";
import { transfer } from "./routes/transfer.js";

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

// ── One directory connection per /v1 request, opened by the first query: a request that asks nothing opens none ───
app.use(`${V1}/*`, openDirectory);

// ── Sign-in (OTP), before the session middleware ─────────────────────────────────────────────────────────────────
app.route(V1_AUTH, auth);

// ── Auth middleware for everything below ──────────────────────────────────────────────────────────────────────────
app.use(`${V1}/*`, requireSession);

// ── Directory ─────────────────────────────────────────────────────────────────────────────────────────────────────
app.get(`${V1}/directory/:${USER_PARAM}`, async (c) => {
  const user = UserId.safeParse(c.req.param(USER_PARAM));
  if (!user.success) return c.json({ error: ApiError.badUserId }, 400);
  const devices = await activeDevices(c.get(Var.db), user.data);
  if (devices.length === 0) return c.json({ error: ApiError.notFound }, 404);
  return c.json({ user: user.data, devices });
});

// ── Mailbox, inbox, the job board, mentors, city guides, rate estimates, personal QR codes and moving phones ─────
app.route(V1, mail);
app.route(`${V1}/board`, board);
app.route(`${V1}/mentors`, mentors);
app.route(`${V1}/cities`, cities);
app.route(`${V1}/content`, content);
app.route(`${V1}/devices`, devices);
app.route(`${V1}/estimates`, estimates);
app.route(`${V1}/find`, find);
app.route(`${V1}/geo/map`, map);
app.route(`${V1}/geo`, geo);
app.route(`${V1}/model`, model);
app.route(`${V1}/phone/confirm`, phoneConfirm);
app.route(`${V1}/qr`, qr);
app.route(`${V1}/transfer`, transfer);

// ── Job records (ADR 0038): the notice, attestation, payments and stars, export and deletion; admin analytics ──────
app.route(`${V1}/consent`, consent);
app.route(`${V1}/jobs/records`, jobRecords);
app.route(`${V1}/jobs/records`, jobMoney);
app.route(`${V1}/me`, me);
app.route(`${V1}/admin`, admin);

app.notFound((c) => c.json({ error: ApiError.notFound }, 404));

export default app;
