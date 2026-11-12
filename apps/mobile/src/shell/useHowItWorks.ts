import { Collection, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";

/** The owner's own setting that How it works was shown, kept with their settings so it moves with the phone. */
const SEEN_KEY = "how_it_works_seen";

/**
 * Whether a worker with no card yet should first see How it works (design S10), once per owner. Undefined while the
 * phone reads it, so the screen never flashes the chat first; anyone else, or a worker with a card, never sees it.
 */
export function useHowItWorks(ports: Ports, due: boolean): { show: boolean | undefined; seen: () => void } {
  const [show, setShow] = useState<boolean | undefined>(due ? undefined : false);
  useEffect(() => {
    if (!due) {
      setShow(false);
      return;
    }
    let live = true;
    void ports.storage.get<boolean>(Collection.ownerSettings, SEEN_KEY).then((was) => {
      if (live) setShow(was !== true);
    });
    return () => {
      live = false;
    };
  }, [ports, due]);
  const seen = useCallback(() => {
    setShow(false);
    void ports.storage.put<boolean>(Collection.ownerSettings, SEEN_KEY, true);
  }, [ports]);
  return { show, seen };
}
