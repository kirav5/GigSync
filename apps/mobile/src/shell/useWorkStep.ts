import { Collection, type Ports } from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";
import { useTalk } from "../talk/talkStore.js";

/**
 * The owner's own setting that the first-card step was shown, kept with their settings so it moves with the phone. The
 * key is the one How it works used, which the work step took the place of: a worker who saw that is not asked again.
 */
const SEEN_KEY = "how_it_works_seen";

/**
 * Whether a worker with no card yet should first pick their work on tiles (start/WorkStep.tsx), once per owner.
 * Undefined while the phone reads it, and until their chats are read too: the picked work starts the card chat in
 * them, which reading them afterwards would replace. Anyone else, or a worker with a card, never sees it.
 */
export function useWorkStep(ports: Ports, due: boolean): { show: boolean | undefined; seen: () => void } {
  const [show, setShow] = useState<boolean | undefined>(due ? undefined : false);
  const { ready } = useTalk();
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
  return { show: show && !ready ? undefined : show, seen };
}
