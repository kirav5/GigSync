/**
 * Whether the app is worth checking the mailbox for right now: on screen, and with a network. An app left open behind
 * another, or a phone with no signal, asks the server nothing; the moment either ends, it checks at once.
 */

const VISIBLE: DocumentVisibilityState = "visible";
const VISIBILITY_EVENT = "visibilitychange";
const ONLINE_EVENT = "online";

/** On screen and online. */
export const awake = (): boolean => document.visibilityState === VISIBLE && navigator.onLine !== false;

/** Calls `woke` each time the app comes back on screen or back online, and is awake; returns how to stop. */
export function onWake(woke: () => void): () => void {
  const check = () => {
    if (awake()) woke();
  };
  document.addEventListener(VISIBILITY_EVENT, check);
  window.addEventListener(ONLINE_EVENT, check);
  return () => {
    document.removeEventListener(VISIBILITY_EVENT, check);
    window.removeEventListener(ONLINE_EVENT, check);
  };
}
