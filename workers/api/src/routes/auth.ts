import { Header } from "@gigsync/core/http";
import { LOCAL_ENVIRONMENT, log, pii, traced } from "@gigsync/core/log";
import { OtpRequest, OtpVerify } from "@gigsync/protocol";
import { Hono } from "hono";
import { isLocked, recordFailure } from "../auth/attempts.js";
import { completeSignIn } from "../auth/signin.js";
import { ApiError, type AppEnv, Var } from "../context.js";
import { hmacHex, sameSecret } from "../crypto.js";
import { requireSecret } from "../env.js";

/** Sign-in by one-time code. Dev accepts DEV_OTP; the SMS gateway arrives in M0 hardening. */
export const auth = new Hono<AppEnv>();

/** Rate-limit key when Cloudflare gives no client IP (only in local tests). */
const UNKNOWN_IP = "unknown";
/**
 * Locally there is no client IP, so every browser shared the one "unknown" bucket and a test suite signing in many
 * people stalled on it; there the bucket is the number instead. Deployments always get Cloudflare's client IP.
 */
const LOCAL_PHONE_KEY = "phone:";
/** What `wrangler dev` puts in CF-Connecting-IP for every local browser: the machine itself, not a client. */
const LOOPBACK = new Set(["::1", "127.0.0.1"]);

/** The client IP to cap sign-ins by; none locally when it is only the loopback address. */
const clientIp = (ip: string | undefined, local: boolean) => (ip && !(local && LOOPBACK.has(ip)) ? ip : undefined);
const OtpChannel = { dev: "dev", sms: "sms" } as const;

const locked = traced("auth.isLocked", isLocked);
const failed = traced("auth.recordFailure", recordFailure);
const signIn = traced("auth.completeSignIn", completeSignIn);

auth.post("/otp/request", async (c) => {
  const body = OtpRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badPhone }, 400);
  log.info("otp requested", { requestId: c.get(Var.requestId), phone: pii(body.data.phone) });
  // TODO(M0): send through the DLT-registered SMS gateway; store a hashed code with a 5-minute expiry.
  return c.json({ sent: true, channel: c.env.DEV_OTP ? OtpChannel.dev : OtpChannel.sms });
});

auth.post("/otp/verify", async (c) => {
  // Two caps: per client IP (stops one machine spraying codes) and per number in D1 (stops one target being guessed).
  const body = OtpVerify.safeParse(await c.req.json().catch(() => null));
  const local = c.env.ENVIRONMENT === LOCAL_ENVIRONMENT;
  const ip = clientIp(c.req.header(Header.cfConnectingIp), local);
  const key = ip ?? (local && body.success ? `${LOCAL_PHONE_KEY}${body.data.phone}` : UNKNOWN_IP);
  if (!(await c.env.OTP_RATE_LIMIT.limit({ key })).success) {
    log.warn("sign-in rate limited", { requestId: c.get(Var.requestId), ip: pii(key) });
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  }
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);

  const db = c.get(Var.db);
  const now = new Date();
  const phoneHmac = await hmacHex(requireSecret(c.env.PHONE_HMAC_KEY, "PHONE_HMAC_KEY"), body.data.phone);
  const who = { requestId: c.get(Var.requestId), phone: pii(body.data.phone) };
  if (await locked(db, phoneHmac, now)) {
    log.warn("sign-in locked", who);
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  }

  if (!c.env.DEV_OTP || !(await sameSecret(body.data.code, c.env.DEV_OTP))) {
    await failed(db, phoneHmac, now);
    log.warn("sign-in wrong code", { ...who, code: pii(body.data.code) });
    return c.json({ error: ApiError.wrongCode }, 401);
  }
  const session = await signIn(db, phoneHmac, body.data.device, now);
  log.info("signed in", { ...who, user: session.user, device: session.device });
  return c.json(session);
});
