import { Header } from "@gigsync/core/http";
import { log, pii, traced } from "@gigsync/core/log";
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
  const ip = c.req.header(Header.cfConnectingIp) ?? UNKNOWN_IP;
  if (!(await c.env.OTP_RATE_LIMIT.limit({ key: ip })).success) {
    log.warn("sign-in rate limited", { requestId: c.get(Var.requestId), ip: pii(ip) });
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  }

  const body = OtpVerify.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);

  const db = c.env.DIRECTORY;
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
