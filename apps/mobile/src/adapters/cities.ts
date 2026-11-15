import { type AreaChoice, areasOf, cityAt, log } from "@gigsync/core";
import { NO_CITY, type Place, type PlaceKey, type ServedCity, type Session } from "@gigsync/protocol";
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
/** The server lets every place in (`LIVE_CITIES=*`, for testing): no place is "not in your area yet". */
let anywhere = false;
/** Where the owner is: a household's address in use, a worker's card. Talk's price answers use its city. */
let home: Place | undefined;

/**
 * The city a place is in, among the cities GigSync serves; outside them all, none of its own when the server lets
 * every place in (so no rate card is borrowed), else the city the app shipped with.
 */
export function cityOf(point: Place | undefined): PlaceKey {
  const inCity = point && known && cityAt(point, known);
  if (inCity) return inCity;
  return point && anywhere ? NO_CITY : PILOT_CITY;
}

/** Whether the server lets every place in, once the phone has heard; false before. */
export const servesAnywhere = (): boolean => anywhere;

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
    .then((served) => {
      if (!served) return undefined;
      known = served.cities;
      anywhere = served.anywhere === true;
      return served.cities;
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
