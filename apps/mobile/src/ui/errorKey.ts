import { HttpError, type MessageKey, NetError, NetReason } from "@gigsync/core";

const NO_ANSWER: Readonly<Record<NetReason, MessageKey>> = {
  [NetReason.timeout]: "net.timeout",
  [NetReason.offline]: "net.no_internet",
};

/** The server's answer when it is asked too often (sign-in codes, per number and per network address). */
const TOO_MANY = 429;

/**
 * What to tell the owner when a call failed: no answer at all (timeout, offline), or too many tries, in their own
 * words; anything else as a generic error.
 */
export function errorKey(err: unknown): MessageKey {
  if (err instanceof NetError) return NO_ANSWER[err.reason];
  return err instanceof HttpError && err.status === TOO_MANY ? "net.too_many" : "error.generic";
}
