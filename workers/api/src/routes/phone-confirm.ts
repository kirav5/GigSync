import { log, pii, traced } from "@gigsync/core/log";
import { OtpChannel, OtpRequest, PhoneConfirm, type PhoneConfirmed } from "@gigsync/protocol";
import { type Context, Hono } from "hono";
import { googleKeys, TokenError, verifyIdToken } from "../auth/firebase.js";
import { ApiError, type AppEnv, Var } from "../context.js";
import { sameSecret } from "../crypto.js";

/**
 * Proving a second number without signing in with it: the Aadhaar check (apps/mobile screens/verify) asks for the
 * number linked to the person's Aadhaar when it is not the one they signed in with, sends an SMS code to it, and asks
 * here whether the code was right. Behind the session middleware; it never creates, ends or changes a session, and
 * writes nothing: no number, hash or count is kept. Wrong guesses are capped per signed-in person by the rate limiter,
 * and with Firebase, Firebase checks the code itself and caps wrong codes per number.
 */
export const phoneConfirm = new Hono<AppEnv>();

type ConfirmContext = Context<AppEnv>;

/** The rate limiter's bucket for one person's confirmations, apart from sign-in's per-IP buckets. */
const CONFIRM_KEY = "confirm:";
const verifyToken = traced("phoneConfirm.verifyIdToken", verifyIdToken);

/** Whether this person is still within their confirmations for now (requests and checks share the cap). */
async function withinLimit(c: ConfirmContext): Promise<boolean> {
  const user = c.get(Var.user);
  if ((await c.env.OTP_RATE_LIMIT.limit({ key: `${CONFIRM_KEY}${user}` })).success) return true;
  log.warn("phone confirm rate limited", { requestId: c.get(Var.requestId), user });
  return false;
}

/** The number a confirmation proves, or the reason it does not (safe to answer with). */
async function proven(c: ConfirmContext, body: PhoneConfirm): Promise<{ error: string; status: 401 | 503 } | null> {
  if ("code" in body) {
    if (c.env.DEV_OTP && (await sameSecret(body.code, c.env.DEV_OTP))) return null;
    return { error: ApiError.wrongCode, status: 401 };
  }
  const projectId = c.env.FIREBASE_PROJECT_ID;
  if (!projectId) return { error: ApiError.phoneSignInOff, status: 503 };
  try {
    const phone = await verifyToken(body.id_token, projectId, new Date(), googleKeys.keyFor);
    // A token for a number other than the one asked about proves nothing about this one.
    if (await sameSecret(phone, body.phone)) return null;
  } catch (err) {
    if (!(err instanceof TokenError)) throw err;
    log.warn("phone confirm bad token", { requestId: c.get(Var.requestId), problem: err.problem });
  }
  return { error: ApiError.badToken, status: 401 };
}

phoneConfirm.post("/request", async (c) => {
  if (!(await withinLimit(c))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const body = OtpRequest.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badPhone }, 400);
  log.info("phone confirm requested", { requestId: c.get(Var.requestId), phone: pii(body.data.phone) });
  // With Firebase configured the phone asks Firebase for the SMS and never calls this; it serves the dev path.
  return c.json({ sent: true, channel: c.env.DEV_OTP ? OtpChannel.enum.dev : OtpChannel.enum.sms });
});

phoneConfirm.post("/", async (c) => {
  if (!(await withinLimit(c))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const body = PhoneConfirm.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const who = { requestId: c.get(Var.requestId), user: c.get(Var.user), phone: pii(body.data.phone) };
  const refused = await proven(c, body.data);
  if (refused) {
    log.warn("phone confirm refused", { ...who, error: refused.error });
    return c.json({ error: refused.error }, refused.status);
  }
  log.info("phone confirmed", who);
  const confirmed: PhoneConfirmed = { confirmed: true };
  return c.json(confirmed);
});
