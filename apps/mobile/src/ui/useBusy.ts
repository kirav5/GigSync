import { useCallback, useRef, useState } from "react";

/**
 * One tap's work at a time. `guard` runs `work` and holds `busy` until it ends, whichever way; a tap while it holds is
 * dropped. The lock is a ref as well as the state, because two taps can land before React has drawn the first.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const held = useRef(false);
  const guard = useCallback(async (work: () => Promise<unknown>): Promise<unknown> => {
    if (held.current) return undefined;
    held.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      held.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, guard };
}
