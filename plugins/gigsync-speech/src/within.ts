/** A browser engine that never answered in time; the caller treats it as unavailable. */
class TimedOut extends Error {}

/**
 * `work`, or a `TimedOut` rejection once `ms` have passed. Chrome can leave its speech `available()` and `install()`
 * unanswered (as its translator does with no language packs), and a page must never wait on them forever.
 */
export function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new TimedOut()), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}
