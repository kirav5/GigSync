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

/** Error messages the API returns as `{ error }`. Safe to show: they never name a value. */
export const ApiError = {
  badRequest: "bad request",
  badUserId: "bad user id",
  badEnvelope: "bad envelope",
  badPhone: "phone must be E.164",
  envelopeMismatch: "envelope does not match route",
  internal: "internal error",
  notFound: "not found",
  recipientNotFound: "recipient not found",
  tooManyAttempts: "too many attempts",
  unauthorized: "unauthorized",
  wrongCode: "wrong code",
} as const;
