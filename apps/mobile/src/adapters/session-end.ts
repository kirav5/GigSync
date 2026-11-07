import type { Fetch } from "@gigsync/core";

/**
 * A session the server no longer takes (it expired, the device was retired or revoked, or the account was frozen) ends
 * here too: every signed-in call that answers 401 tells the app, once, and the app returns to sign-in instead of
 * failing every sync from then on.
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
