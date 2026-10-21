import { type DeviceId, Envelope, MessageId, UserId } from "@collab/protocol";
import { Mailbox } from "@collab/worker-mailbox";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { routePath } from "hono/route";
import { z } from "zod";
import type { Env } from "./env.js";
import { auth } from "./routes/auth.js";

export type { Env };
export { Mailbox };

type Vars = { user: UserId; device: DeviceId };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ── CORS: only the origins in ALLOWED_ORIGINS. Auth is a bearer token, never a cookie, so no credentials mode. ──────
app.use("*", (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
    maxAge: 86400,
  })(c, next);
});

// One place for the unexpected: log what failed, never the request (it may hold phone numbers, keys or content).
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(JSON.stringify({ route: routePath(c), method: c.req.method, error: err.name, message: err.message }));
  return c.json({ error: "internal error" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, protocol: 1 }));

// ── Sign-in (OTP), before the session middleware ─────────────────────────────────────────────────────────────────
app.route("/v1/auth", auth);

// ── Auth middleware for everything below ──────────────────────────────────────────────────────────────────────────
app.use("/v1/*", async (c, next) => {
  if (c.req.path.startsWith("/v1/auth/")) return next();
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DIRECTORY.prepare(
    "SELECT user_id, device_id FROM sessions WHERE token = ? AND revoked_at IS NULL",
  )
    .bind(token)
    .first<{ user_id: UserId; device_id: DeviceId }>();
  if (!row) return c.json({ error: "unauthorized" }, 401);
  c.set("user", row.user_id);
  c.set("device", row.device_id);
  await next();
});

// ── Directory ─────────────────────────────────────────────────────────────────────────────────────────────────────
app.get("/v1/directory/:user", async (c) => {
  const user = UserId.safeParse(c.req.param("user"));
  if (!user.success) return c.json({ error: "bad user id" }, 400);
  const { results } = await c.env.DIRECTORY.prepare(
    "SELECT device_id, signing_key, encryption_key, protocol FROM devices WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(user.data)
    .all();
  if (results.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ user: user.data, devices: results });
});

// ── Deliver to someone else's mailbox ────────────────────────────────────────────────────────────────────────────────────────────────
app.post("/v1/mailbox/:user", async (c) => {
  const to = UserId.safeParse(c.req.param("user"));
  const env = Envelope.safeParse(await c.req.json().catch(() => null));
  if (!to.success || !env.success) return c.json({ error: "bad envelope" }, 400);
  if (env.data.to.user !== to.data || env.data.from.user !== c.get("user"))
    return c.json({ error: "envelope does not match route" }, 403);
  // TODO(M2): verify `sig` against the sender device's signing key from the directory before accepting.
  const { results } = await c.env.DIRECTORY.prepare(
    "SELECT device_id FROM devices WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(to.data)
    .all<{ device_id: DeviceId }>();
  if (results.length === 0) return c.json({ error: "recipient not found" }, 404);
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(to.data));
  const out = await box.deliver({ envelope: env.data, devices: results.map((r) => r.device_id) });
  // TODO(M2): if no device has an open socket, enqueue an FCM wake-up on the Queue.
  return c.json(out, out.stored ? 201 : 200);
});

// ── My inbox: what the mailbox holds for this device ──────────────────────────────────────────────────────────────
app.get("/v1/inbox", async (c) => {
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get("user")));
  return c.json(await box.fetchFor(c.get("device")));
});

app.post("/v1/inbox/ack", async (c) => {
  const body = z.object({ ids: z.array(MessageId).min(1).max(500) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "bad request" }, 400);
  const box = c.env.MAILBOX.get(c.env.MAILBOX.idFromName(c.get("user")));
  return c.json({ acked: await box.ack(c.get("device"), body.data.ids) });
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
