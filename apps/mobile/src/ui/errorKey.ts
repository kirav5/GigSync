import { type MessageKey, NetError, NetReason } from "@gigsync/core";

const NO_ANSWER: Readonly<Record<NetReason, MessageKey>> = {
  [NetReason.timeout]: "net.timeout",
  [NetReason.offline]: "net.offline",
};

/** What to tell the owner when a call failed: no answer at all (timeout, offline) in its own words, else a generic error. */
export function errorKey(err: unknown): MessageKey {
  return err instanceof NetError ? NO_ANSWER[err.reason] : "error.generic";
}
