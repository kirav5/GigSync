import { log } from "@gigsync/core";
import type { ServedCity, Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { apiClient } from "./account.js";

/**
 * The cities GigSync serves (ADR 0061), read once per run of the app and shared by every screen. Until they arrive, or
 * if they cannot, the city the app shipped with stands in (`served` in core), so the check never blocks anyone.
 */
let kept: Promise<ServedCity[] | undefined> | undefined;

function citiesFor(session: Session): Promise<ServedCity[] | undefined> {
  kept ??= apiClient(session)
    .cities()
    .catch((err: unknown) => {
      kept = undefined;
      log.warn("cities not read", { error: err instanceof Error ? err.name : typeof err });
      return undefined;
    });
  return kept;
}

export function useServedCities(session: Session | undefined): readonly ServedCity[] | undefined {
  const [cities, setCities] = useState<readonly ServedCity[]>();
  useEffect(() => {
    if (session) void citiesFor(session).then((c) => c && setCities(c));
  }, [session]);
  return cities;
}
