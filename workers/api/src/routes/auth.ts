import { Header } from "@gigsync/core/http";
import { LOCAL_ENVIRONMENT, log, pii, traced } from "@gigsync/core/log";
import {
  type DeviceRegistration,
  OtpChannel,
  OtpRequest,
  type OtpSent,
  OtpVerify,
  type Phone,
  PhoneTokenVerify,
} from "@gigsync/protocol";
import { type Context, Hono } from "hono";
import { isLocked, recordFailure } from "../auth/attempts.js";
import { codeMatches, issueCode, SendRefused } from "../auth/codes.js";
import { googleKeys, TokenError, verifyIdToken } from "../auth/firebase.js";
import { codeSenders } from "../auth/senders.js";
import { completeSignIn } from "../auth/signin.js";
import { ApiError, type AppEnv, Var } from "../context.js";
import { hmacHex, sameSecret } from "../crypto.js";
import type { Db } from "../db/client.js";
import { dropCode } from "../db/otp-codes.js";
import { requireSecret } from "../env.js";

/**
 * Sign-in by one-time code. Three ways to prove a number: the API sends a code by WhatsApp and checks it (`/otp/request`
 * then `/otp/verify`, ADR 0069); Firebase sends and checks an SMS code and the phone brings its ID token
 * (`/phone/verify`); or, in dev, the fixed DEV_OTP (`/otp/verify`). All end in the same lockout and session.
 */
export const auth = new Hono<AppEnv>();

type AuthContext = Context<AppEnv>;

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

const locked = traced("auth.isLocked", isLocked);
const failed = traced("auth.recordFailure", recordFailure);
const signIn = traced("auth.completeSignIn", completeSignIn);
const verifyToken = traced("auth.verifyIdToken", verifyIdToken);
const issue = traced("auth.issueCode", issueCode);
const matches = traced("auth.codeMatches", codeMatches);

/** The per-IP cap (stops one machine spraying codes or tokens); locally the number, when known, stands in for the IP. */
async function withinIpLimit(c: AuthContext, phone: string | undefined): Promise<boolean> {
  const local = c.env.ENVIRONMENT === LOCAL_ENVIRONMENT;
  const ip = clientIp(c.req.header(Header.cfConnectingIp), local);
  const key = ip ?? (local && phone ? `${LOCAL_PHONE_KEY}${phone}` : UNKNOWN_IP);
  if ((await c.env.OTP_RATE_LIMIT.limit({ key })).success) return true;
  log.warn("sign-in rate limited", { requestId: c.get(Var.requestId), ip: pii(key) });
  return false;
}

/** One sign-in attempt for a number: its hash (the per-number cap and the user are keyed by it) and log fields. */
interface Attempt {
  db: Db;
  now: Date;
  /** The HMAC key: numbers and the codes sent to them are kept only as HMACs. */
  key: string;
  phone: Phone;
  phoneHmac: string;
  who: { requestId: string; phone: ReturnType<typeof pii> };
}

async function attemptFor(c: AuthContext, phone: Phone): Promise<Attempt> {
  const key = requireSecret(c.env.PHONE_HMAC_KEY, "PHONE_HMAC_KEY");
  const phoneHmac = await hmacHex(key, phone);
  const who = { requestId: c.get(Var.requestId), phone: pii(phone) };
  return { db: c.get(Var.db), now: new Date(), key, phone, phoneHmac, who };
}

/** True, and logged, when the number has used up its wrong codes for now. */
async function lockedOut(attempt: Attempt): Promise<boolean> {
  if (!(await locked(attempt.db, attempt.phoneHmac, attempt.now))) return false;
  log.warn("sign-in locked", attempt.who);
  return true;
}

/** A proven number: registers the device and answers with its session. */
async function finish(c: AuthContext, attempt: Attempt, device: DeviceRegistration) {
  const session = await signIn(attempt.db, attempt.phoneHmac, device, attempt.now);
  log.info("signed in", { ...attempt.who, user: session.user, device: session.device });
  return c.json(session);
}

/** What `/otp/request` answers when the code is on its way. */
const sentBy = (channel: OtpChannel): OtpSent => ({ sent: true, channel });

auth.post("/otp/request", async (c) => {
  const body = OtpRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badPhone }, 400);
  log.info("otp requested", { requestId: c.get(Var.requestId), phone: pii(body.data.phone) });
  const senders = codeSenders(c.env);
  // With no sender set up, the phone asks Firebase for the SMS when it has Firebase, and this serves the dev path.
  if (!senders.length) return c.json(sentBy(c.env.DEV_OTP ? OtpChannel.enum.dev : OtpChannel.enum.sms));
  // Every code sent is paid for: capped per client IP here, and per number in the directory (keepCode).
  if (!(await withinIpLimit(c, body.data.phone))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const attempt = await attemptFor(c, body.data.phone);
  const issued = await issue(attempt, senders);
  if ("refused" in issued) {
    log.warn("otp not sent", { ...attempt.who, refused: issued.refused });
    return issued.refused === SendRefused.tooSoon
      ? c.json({ error: ApiError.tooManyAttempts }, 429)
      : c.json({ error: ApiError.codeNotSent }, 502);
  }
  log.info("otp sent", { ...attempt.who, channel: issued.channel });
  return c.json(sentBy(issued.channel));
});

/**
 * True when `code` proves the number: the code the API sent when it sends codes (WhatsApp or MSG91; and then never
 * the dev code, so a DEV_OTP left on a deployment cannot sign anyone in), otherwise the dev code.
 */
async function codeProves(c: AuthContext, attempt: Attempt, code: string): Promise<boolean> {
  if (codeSenders(c.env).length) return matches(attempt, code);
  return c.env.DEV_OTP ? sameSecret(code, c.env.DEV_OTP) : false;
}

auth.post("/otp/verify", async (c) => {
  // Two caps: per client IP, and per number in the directory (stops one target being guessed).
  const body = OtpVerify.safeParse(await c.req.json().catch(() => null));
  if (!(await withinIpLimit(c, body.data?.phone))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const attempt = await attemptFor(c, body.data.phone);
  if (await lockedOut(attempt)) return c.json({ error: ApiError.tooManyAttempts }, 429);
  if (!(await codeProves(c, attempt, body.data.code))) {
    await failed(attempt.db, attempt.phoneHmac, attempt.now);
    log.warn("sign-in wrong code", { ...attempt.who, code: pii(body.data.code) });
    return c.json({ error: ApiError.wrongCode }, 401);
  }
  // A code the API sent signs in once.
  if (codeSenders(c.env).length) await dropCode(attempt.db, attempt.phoneHmac);
  return finish(c, attempt, body.data.device);
});

auth.post("/phone/verify", async (c) => {
  // Firebase checked the code and caps wrong ones itself; here the token is checked, then the same caps as above.
  const projectId = c.env.FIREBASE_PROJECT_ID;
  if (!projectId) return c.json({ error: ApiError.phoneSignInOff }, 503);
  if (!(await withinIpLimit(c, undefined))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const body = PhoneTokenVerify.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  let phone: Phone;
  try {
    phone = await verifyToken(body.data.id_token, projectId, new Date(), googleKeys.keyFor);
  } catch (err) {
    if (!(err instanceof TokenError)) throw err;
    log.warn("sign-in bad token", { requestId: c.get(Var.requestId), problem: err.problem });
    return c.json({ error: ApiError.badToken }, 401);
  }
  const attempt = await attemptFor(c, phone);
  if (await lockedOut(attempt)) return c.json({ error: ApiError.tooManyAttempts }, 429);
  return finish(c, attempt, body.data.device);
});
