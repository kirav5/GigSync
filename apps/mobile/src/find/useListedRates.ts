import { log, NeedSlot, type NeedState } from "@gigsync/core";
import { coarsePoint, type SavedAddress, type Session } from "@gigsync/protocol";
import { useEffect } from "react";
import { apiClient } from "../adapters/account.js";
import { whereOf } from "./ask.js";
import { needListedFound } from "./needStore.js";

/** How far workers' rates are read: wider than the first search, to reach the three a range needs. */
const RATES_RADIUS_KM = 10;

/**
 * At the budget question for a listed skill: what workers nearby list, read once for the skill and place (ADR 0057).
 * Only the skill's key and a coarse point are sent. No answer leaves the question as it was.
 */
export function useListedRates(
  session: Session,
  chat: string,
  state: NeedState | undefined,
  saved: readonly SavedAddress[] | undefined,
): void {
  const skill = state?.slot === NeedSlot.budget ? state.draft.skill?.key : undefined;
  const at = state && skill ? whereOf(state.draft, saved ?? [])?.area : undefined;
  const key = skill && at ? `${skill}:${at.lat}:${at.lon}` : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once per skill and place, keyed on `key`
  useEffect(() => {
    if (!skill || !at) return;
    const near = coarsePoint(at);
    apiClient(session)
      .listedRates({ skill, lat: near.lat, lon: near.lon, radius_km: RATES_RADIUS_KM })
      .then((rates) => needListedFound(chat, rates))
      .catch((err: unknown) =>
        log.warn("listed rates failed", { error: err instanceof Error ? err.name : typeof err }),
      );
  }, [key, chat, session]);
}
