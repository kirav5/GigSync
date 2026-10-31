import { NetError, NetReason } from "./errors.js";

/** How long one API call may take, answer included: a reply lost on a bad network must not leave a screen busy. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** AbortSignal.timeout where the web view has it (Safari 16, Chrome 103 on), else the same from a timer. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Runs one request with a deadline. The signal stops a fetch that honours it; the race stops one that does not. No
 * answer by the deadline is a timeout; the TypeError fetch throws without a network is offline.
 */
export async function withDeadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = timeoutSignal(ms);
  const late = new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(new NetError(NetReason.timeout)), { once: true }),
  );
  // The deadline fires after a call that answered in time too; nothing is listening then.
  late.catch(() => undefined);
  try {
    return await Promise.race([work(signal), late]);
  } catch (err) {
    if (signal.aborted) throw new NetError(NetReason.timeout);
    if (err instanceof TypeError) throw new NetError(NetReason.offline);
    throw err;
  }
}
