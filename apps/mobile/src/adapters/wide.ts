import { useSyncExternalStore } from "react";

/**
 * Wide enough for the menu to stand beside the content, as collab's sidebar does on a computer; narrower, it is a
 * drawer over the screen. The same breakpoint as `shell/shell.css`, and collab's (web/styles.css, 820px), in CSS px.
 */
const WIDE_QUERY = "(min-width: 821px)";

function subscribe(listener: () => void): () => void {
  const query = matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const isWide = () => matchMedia(WIDE_QUERY).matches;

/** True while the screen is wide enough for the menu beside the content; re-renders when that changes. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, isWide);
}
