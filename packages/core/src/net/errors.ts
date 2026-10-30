/** A non-2xx answer from the API: the status and its safe `{ error }` message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly error: string,
  ) {
    super(`API ${status}: ${error}`);
  }
}

/** Why a call never got an answer: it ran out of time, or the phone had no network. */
export const NetReason = { timeout: "timeout", offline: "offline" } as const;
export type NetReason = (typeof NetReason)[keyof typeof NetReason];

/** A call that got no answer from the API at all (as opposed to an error answer, which is an HttpError). */
export class NetError extends Error {
  constructor(readonly reason: NetReason) {
    super(`API unreachable: ${reason}`);
  }
}
