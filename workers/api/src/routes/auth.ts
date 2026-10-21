import { OtpRequest, OtpVerify } from "@collab/protocol";
import { Hono } from "hono";
import { isLocked, recordFailure } from "../auth/attempts.js";
import { completeSignIn } from "../auth/signin.js";
import { hmacHex, sameSecret } from "../crypto.js";
import { type Env, requireSecret } from "../env.js";

/** Sign-in by one-time code. Dev accepts DEV_OTP; the SMS gateway arrives in M0 hardening. */
export const auth = new Hono<{ Bindings: Env }>();

auth.post("/otp/request", async (c) => {
  const body = OtpRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "phone must be E.164" }, 400);
  // TODO(M0): send through the DLT-registered SMS gateway; store a hashed code with a 5-minute expiry.
  return c.json({ sent: true, channel: c.env.DEV_OTP ? "dev" : "sms" });
});

auth.post("/otp/verify", async (c) => {
  // Two caps: per client IP (stops one machine spraying codes) and per number in D1 (stops one target being guessed).
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await c.env.OTP_RATE_LIMIT.limit({ key: ip })).success) return c.json({ error: "too many attempts" }, 429);

  const body = OtpVerify.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "bad request" }, 400);

  const db = c.env.DIRECTORY;
  const now = new Date();
  const phoneHmac = await hmacHex(requireSecret(c.env.PHONE_HMAC_KEY, "PHONE_HMAC_KEY"), body.data.phone);
  if (await isLocked(db, phoneHmac, now)) return c.json({ error: "too many attempts" }, 429);

  if (!c.env.DEV_OTP || !(await sameSecret(body.data.code, c.env.DEV_OTP))) {
    await recordFailure(db, phoneHmac, now);
    return c.json({ error: "wrong code" }, 401);
  }
  return c.json(await completeSignIn(db, phoneHmac, body.data.device, now));
});
