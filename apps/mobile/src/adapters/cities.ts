import { type AreaChoice, areasOf, cityAt, log } from "@gigsync/core";
import type { Place, PlaceKey, ServedCity, Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { PILOT_CITY } from "../ui/places.js";
import { apiClient } from "./account.js";

/**
 * The cities GigSync serves (ADR 0061), read once per run of the app and shared by every screen. Until they arrive, or
 * if they cannot, the city the app shipped with stands in (`served` in core), so the check never blocks anyone.
 */
let kept: Promise<ServedCity[] | undefined> | undefined;
/** The list once it arrived, for code that cannot wait on it. */
let known: readonly ServedCity[] | undefined;
/** Where the owner is: a household's address in use, a worker's card. Talk's price answers use its city. */
let home: Place | undefined;

/** The city a place is in, among the cities GigSync serves; the city the app shipped with when that is not known. */
export const cityOf = (point: Place | undefined): PlaceKey => (point && known && cityAt(point, known)) || PILOT_CITY;

/** Where the owner is now, for prices asked about with no place named. */
export function rememberHome(point: Place | undefined): void {
  if (point) home = point;
}

/** The areas the directory serves, once the phone has the list; none before. */
export const knownAreas = (): AreaChoice[] => (known ? areasOf(known) : []);

/** The owner's own city. */
export const homeCity = (): PlaceKey => cityOf(home);

function citiesFor(session: Session): Promise<ServedCity[] | undefined> {
  kept ??= apiClient(session)
    .cities()
    .catch((err: unknown) => {
      kept = undefined;
      log.warn("cities not read", { error: err instanceof Error ? err.name : typeof err });
      return undefined;
    })
    .then((list) => {
      if (list) known = list;
      return list;
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
