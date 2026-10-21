import { type DeviceId, Envelope, MessageId, UserId } from "@collab/protocol";
import { Mailbox } from "@collab/worker-mailbox";
import { Hono } from "hono";
import { ulid } from "ulid";
import { z } from "zod";

export { Mailbox };

export interface Env {
  DIRECTORY: D1Database;
  MAILBOX: DurableObjectNamespace<Mailbox>;
  ENVIRONMENT: string;
  DEV_OTP?: string;
  /** Secret: HMAC key for phone-number hashes. `wrangler secret put PHONE_HMAC_KEY`. */
  PHONE_HMAC_KEY?: string;
}

type Vars = { user: UserId; device: DeviceId };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.get("/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, protocol: 1 }));

// ── Sign-in (OTP). Dev accepts DEV_OTP; the SMS gateway arrives in M0 hardening. ─────────────────────────────────
const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "E.164");

app.post("/v1/auth/otp/request", async (c) => {
  const body = z.object({ phone: Phone }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "phone must be E.164" }, 400);
  // TODO(M0): send through the DLT-registered SMS gateway; store a hashed code with a 5-minute expiry.
  return c.json({ sent: true, channel: c.env.DEV_OTP ? "dev" : "sms" });
});

app.post("/v1/auth/otp/verify", async (c) => {
  const Body = z.object({
    phone: Phone,
    code: z.string().length(6),
    device: z.object({
      signing_key: z.string(),
      encryption_key: z.string(),
      protocol: z.number().int(),
      push_token: z.string().optional(),
    }),
  });
  const body = Body.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "bad request" }, 400);
  if (!c.env.DEV_OTP || body.data.code !== c.env.DEV_OTP) return c.json({ error: "wrong code" }, 401);

  const phoneHash = await hmacHex(c.env.PHONE_HMAC_KEY ?? "dev-only-key", body.data.phone);
  const now = new Date().toISOString();
  const existing = await c.env.DIRECTORY.prepare("SELECT user_id FROM phone_bindings WHERE phone_hmac = ?")
    .bind(phoneHash)
    .first<{ user_id: UserId }>();
  const user = existing?.user_id ?? (`usr_${ulid()}` as UserId);
  if (!existing) {
    await c.env.DIRECTORY.batch([
      c.env.DIRECTORY.prepare("INSERT INTO users (user_id, created_at, status) VALUES (?, ?, 'active')").bind(
        user,
        now,
      ),
      c.env.DIRECTORY.prepare("INSERT INTO phone_bindings (phone_hmac, user_id, verified_at) VALUES (?, ?, ?)").bind(
        phoneHash,
        user,
        now,
      ),
    ]);
  }
  const device = `dev_${ulid()}` as DeviceId;
  const d = body.data.device;
  await c.env.DIRECTORY.prepare(
    "INSERT INTO devices (device_id, user_id, signing_key, encryption_key, protocol, push_token, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(device, user, d.signing_key, d.encryption_key, d.protocol, d.push_token ?? null, now, now)
    .run();
  const token = `ses_${ulid()}`;
  await c.env.DIRECTORY.prepare("INSERT INTO sessions (token, user_id, device_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, user, device, now)
    .run();
  return c.json({ user, device, token });
});

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

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
