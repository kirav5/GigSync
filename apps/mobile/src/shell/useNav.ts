import { useCallback, useMemo, useState } from "react";
import type { Screen } from "../state.js";

/** Where the owner is: the screens on the way to the open one, the landing screen first. */
export interface Nav {
  /** The open screen: the top of the stack. */
  screen: Screen;
  stack: readonly Screen[];
  /**
   * Opens a screen. A tab (or the landing screen) starts the stack again from the landing screen; any other screen
   * goes on top, or, when it is on the stack already, is stepped back to.
   */
  go: (to: Screen) => void;
  /** Opens `to` only while `from` is the open screen: a prompt must not pull the owner off where they went meanwhile. */
  goFrom: (from: Screen, to: Screen) => void;
  /** Steps back one screen; false on the landing screen, where Back leaves the app. */
  back: () => boolean;
}

/** The stack after opening `to`, given the landing screen and whether `to` is a tab. */
function opened(stack: readonly Screen[], to: Screen, landing: Screen, tab: boolean): readonly Screen[] {
  if (to === landing) return [landing];
  if (tab) return [landing, to];
  const at = stack.indexOf(to);
  if (at >= 0) return stack.slice(0, at + 1);
  return [...stack, to];
}

/**
 * The navigation stack, as a phone app's: a tab tap starts it again at that tab (above the landing screen, so Back
 * from any tab comes to the landing one, then leaves), a screen opened from inside another goes on top, and Back pops
 * it. `isTab` says which screens are this owner's tabs; the landing screen is the owner's Home, their chat.
 */
export function useNav(landing: Screen, isTab: (s: Screen) => boolean): Nav {
  const [stack, setStack] = useState<readonly Screen[]>([landing]);

  const go = useCallback((to: Screen) => setStack((now) => opened(now, to, landing, isTab(to))), [landing, isTab]);
  const goFrom = useCallback(
    (from: Screen, to: Screen) =>
      setStack((now) => (now[now.length - 1] === from ? opened(now, to, landing, isTab(to)) : now)),
    [landing, isTab],
  );
  const back = useCallback((): boolean => {
    if (stack.length <= 1) return false;
    setStack(stack.slice(0, -1));
    return true;
  }, [stack]);

  return useMemo(
    () => ({ screen: stack[stack.length - 1] ?? landing, stack, go, goFrom, back }),
    [stack, landing, go, goFrom, back],
  );
}
