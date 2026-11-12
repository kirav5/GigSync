import { type LoadedGuide, loadGuide, log, type Ports } from "@gigsync/core";
import type { City, Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { apiClient } from "../../adapters/account.js";

/**
 * A city's guide (its helplines, places and label), from the copy on this phone when fresh, else a download: undefined
 * while it loads, null when there is none to show (never downloaded and no network). Help and the mentor screens read
 * it; the landing journey has its own, which also follows the move.
 */
export function useGuide(ports: Ports, session: Session, city: City): LoadedGuide | null | undefined {
  const [loaded, setLoaded] = useState<LoadedGuide | null>();
  useEffect(() => {
    let live = true;
    const fetchGuide = (c: City) => apiClient(session).cityGuide(c);
    loadGuide(ports.storage, fetchGuide, city, ports.clock.now()).then(
      (found) => live && setLoaded(found ?? null),
      (err: unknown) => {
        log.warn("guide not loaded", { error: err instanceof Error ? err.message : String(err) });
        if (live) setLoaded(null);
      },
    );
    return () => {
      live = false;
    };
  }, [ports, session, city]);
  return loaded;
}
