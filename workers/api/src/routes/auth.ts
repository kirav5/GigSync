import { Header } from "@gigsync/core/http";
import { LOCAL_ENVIRONMENT, log, pii, traced } from "@gigsync/core/log";
import {
  ConnectorSignIn,
  type DeviceRegistration,
  OtpRequest,
  OtpVerify,
  type Phone,
  PhoneTokenVerify,
} from "@gigsync/protocol";
import { type Context, Hono } from "hono";
import { clearFailures, isLocked, recordFailure } from "../auth/attempts.js";
import { googleKeys, TokenError, verifyIdToken } from "../auth/firebase.js";
import { completeSignIn } from "../auth/signin.js";
import { ApiError, type AppEnv, Var } from "../context.js";
import { hmacHex, sameSecret } from "../crypto.js";
import type { Db } from "../db/client.js";
import { insertConnectorSession } from "../db/connector-sessions.js";
import { userForPhone } from "../db/users.js";
import { requireSecret } from "../env.js";

/**
 * Sign-in by one-time code. Two ways to prove a number: Firebase sends and checks the SMS code and the phone brings its
 * ID token (`/phone/verify`), or, in dev, the fixed DEV_OTP (`/otp/verify`). Both end in the same lockout and session.
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
/** How a code request is answered: the dev code, or an SMS (Firebase's, sent by the phone itself). */
export const OtpChannel = { dev: "dev", sms: "sms" } as const;

const locked = traced("auth.isLocked", isLocked);
const failed = traced("auth.recordFailure", recordFailure);
const signIn = traced("auth.completeSignIn", completeSignIn);
const verifyToken = traced("auth.verifyIdToken", verifyIdToken);

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
  phoneHmac: string;
  who: { requestId: string; phone: ReturnType<typeof pii> };
}

async function attemptFor(c: AuthContext, phone: Phone): Promise<Attempt> {
  const phoneHmac = await hmacHex(requireSecret(c.env.PHONE_HMAC_KEY, "PHONE_HMAC_KEY"), phone);
  return { db: c.get(Var.db), now: new Date(), phoneHmac, who: { requestId: c.get(Var.requestId), phone: pii(phone) } };
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

auth.post("/otp/request", async (c) => {
  const body = OtpRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badPhone }, 400);
  log.info("otp requested", { requestId: c.get(Var.requestId), phone: pii(body.data.phone) });
  // With Firebase configured the phone asks Firebase for the SMS and never calls this; it serves the dev path.
  return c.json({ sent: true, channel: c.env.DEV_OTP ? OtpChannel.dev : OtpChannel.sms });
});

auth.post("/otp/verify", async (c) => {
  // Two caps: per client IP, and per number in the directory (stops one target being guessed).
  const body = OtpVerify.safeParse(await c.req.json().catch(() => null));
  if (!(await withinIpLimit(c, body.data?.phone))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const attempt = await attemptFor(c, body.data.phone);
  if (await lockedOut(attempt)) return c.json({ error: ApiError.tooManyAttempts }, 429);
  if (!c.env.DEV_OTP || !(await sameSecret(body.data.code, c.env.DEV_OTP))) {
    await failed(attempt.db, attempt.phoneHmac, attempt.now);
    log.warn("sign-in wrong code", { ...attempt.who, code: pii(body.data.code) });
    return c.json({ error: ApiError.wrongCode }, 401);
  }
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

/** The number a connector sign-in proves: the dev code, or a Firebase ID token naming that same number. */
async function connectorProof(
  c: AuthContext,
  body: ConnectorSignIn,
): Promise<Phone | { error: string; status: 401 | 503 }> {
  if ("code" in body) {
    return c.env.DEV_OTP && (await sameSecret(body.code, c.env.DEV_OTP))
      ? body.phone
      : { error: ApiError.wrongCode, status: 401 };
  }
  const projectId = c.env.FIREBASE_PROJECT_ID;
  if (!projectId) return { error: ApiError.phoneSignInOff, status: 503 };
  try {
    const phone = await verifyToken(body.id_token, projectId, new Date(), googleKeys.keyFor);
    if (await sameSecret(phone, body.phone)) return phone;
  } catch (err) {
    if (!(err instanceof TokenError)) throw err;
    log.warn("connector sign-in bad token", { requestId: c.get(Var.requestId), problem: err.problem });
  }
  return { error: ApiError.badToken, status: 401 };
}

/**
 * A connected assistant signing in for its owner (ADR 0068): the same caps as the app, but no device and no new
 * account. A number not yet on GigSync is refused: people join in the app, where their keys are made.
 */
auth.post("/connector", async (c) => {
  const body = ConnectorSignIn.safeParse(await c.req.json().catch(() => null));
  if (!(await withinIpLimit(c, body.data?.phone))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const attempt = await attemptFor(c, body.data.phone);
  if (await lockedOut(attempt)) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const proof = await connectorProof(c, body.data);
  if (typeof proof !== "string") {
    await failed(attempt.db, attempt.phoneHmac, attempt.now);
    log.warn("connector sign-in refused", { ...attempt.who, error: proof.error });
    return c.json({ error: proof.error }, proof.status);
  }
  const user = await userForPhone(attempt.db, attempt.phoneHmac);
  if (!user) return c.json({ error: ApiError.noAccount }, 404);
  const token = await insertConnectorSession(attempt.db, user, attempt.now);
  await clearFailures(attempt.db, attempt.phoneHmac);
  log.info("connector signed in", { ...attempt.who, user });
  return c.json({ user, token });
});
