import { type FoundEstimate, lookupEstimate } from "@gigsync/core";
import type { EstimateRequest, Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { apiClient } from "../adapters/account.js";

/**
 * Rate estimates as the screens ask for them (ADR 0030). An estimate found is kept while the app is open: the server
 * caches for a week, and a screen opened again should not wait for the network. "No estimate" and failures never
 * block anything (the screen falls back to the city band, then nothing) and are asked again next time, since the
 * server may have been reading the web or the phone offline.
 */

const found = new Map<string, Promise<FoundEstimate | undefined>>();

/** The estimate for `request`, looked up once per app session. */
export function fetchEstimate(session: Session, request: EstimateRequest): Promise<FoundEstimate | undefined> {
  const key = JSON.stringify(request);
  const known = found.get(key);
  if (known) return known;
  const asked = lookupEstimate(apiClient(session), request).then((estimate) => {
    if (!estimate) found.delete(key);
    return estimate ? { request, estimate } : undefined;
  });
  found.set(key, asked);
  return asked;
}

/** The estimate for `request` once it arrives; undefined before, without a request, or when there is none. */
export function useEstimate(session: Session, request: EstimateRequest | undefined): FoundEstimate | undefined {
  const [shown, setShown] = useState<FoundEstimate>();
  const key = request ? JSON.stringify(request) : undefined;
  // The request is compared by value (its JSON): a new object for the same job must not fetch again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the request's JSON
  useEffect(() => {
    setShown(undefined);
    if (!request) return;
    let live = true;
    void fetchEstimate(session, request).then((f) => {
      if (live) setShown(f);
    });
    return () => {
      live = false;
    };
  }, [session, key]);
  return shown;
}
