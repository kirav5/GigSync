import type { DeviceId, UserId } from "@gigsync/protocol";
import type { Db } from "./db/client.js";
import type { Env } from "./env.js";

/** Keys of the values middleware stores on each request (c.set / c.get). */
export const Var = { user: "user", device: "device", requestId: "requestId", db: "db" } as const;

export type Vars = { [Var.user]: UserId; [Var.device]: DeviceId; [Var.requestId]: string; [Var.db]: Db };
export type AppEnv = { Bindings: Env; Variables: Vars };

/** Route prefixes. Everything under V1 needs a session except V1_AUTH. */
export const V1 = "/v1";
export const V1_AUTH = `${V1}/auth`;
/** Header carrying the admin key for admin-only routes (the vouch route); compared with env ADMIN_KEY. */
export const ADMIN_HEADER = "x-gigsync-admin";
/** Path parameter naming the user a directory or mailbox route is about. */
export const USER_PARAM = "user";
/** Path parameter naming a personal QR code. */
export const CODE_PARAM = "code";
/** Path parameter naming one of the caller's devices. */
export const DEVICE_PARAM = "device";
/** Path parameter naming a transfer slot. */
export const SLOT_PARAM = "slot";
/** Path parameters naming a stored job and one of its payments. */
export const ENGAGEMENT_PARAM = "engagement";
export const PAYMENT_PARAM = "payment";

/** Error messages the API returns as `{ error }`. Safe to show: they never name a value. */
export const ApiError = {
  badRequest: "bad request",
  badUserId: "bad user id",
  badEnvelope: "bad envelope",
  badPhone: "phone must be E.164",
  badSignature: "bad signature",
  callingDevice: "cannot revoke the calling device",
  envelopeMismatch: "envelope does not match route",
  expired: "expired",
  forbidden: "forbidden",
  internal: "internal error",
  notFound: "not found",
  offerNotTaken: "offer not taken",
  recipientNotFound: "recipient not found",
  tooLarge: "too large",
  tooManyAttempts: "too many attempts",
  unauthorized: "unauthorized",
  wrongCode: "wrong code",
} as const;
