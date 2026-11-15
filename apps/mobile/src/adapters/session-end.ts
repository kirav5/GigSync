import type { Fetch } from "@gigsync/core";

/**
 * A session the server no longer takes (it expired, the device was retired or revoked, the account was frozen, or the
 * server lost it, as the test API does on every restart) ends here too: every signed-in call that answers 401 tells
 * the app, once, and the app opens sign-in on the same number with "Sign in again" instead of failing every sync from
 * then on. Only a 401 does this: offline, or any other error, keeps the owner signed in.
 */

const UNAUTHORIZED = 401;
let ended: (() => void) | undefined;

/** The app's sign-out, run the first time a signed-in call is refused; returns the unsubscribe. */
export function onSessionEnded(signOut: () => void): () => void {
  let fired = false;
  ended = () => {
    if (fired) return;
    fired = true;
    signOut();
  };
  return () => {
    ended = undefined;
  };
}

/** `fetch`, watching for a refused session. */
export const watchedFetch: Fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === UNAUTHORIZED) ended?.();
  return res;
};
