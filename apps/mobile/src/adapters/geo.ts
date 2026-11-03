import { HttpError } from "@gigsync/core";
import type { GeoPlace, Place, Session } from "@gigsync/protocol";
import { apiClient } from "./account.js";

/**
 * Where the owner is, and what a point or typed words are (ADR 0045). The phone is asked once, only after the app said
 * why: with low accuracy for a worker's area, which is all that needs, and with the phone's best accuracy for a
 * household's address, the door a worker comes to; the point is rounded to about a kilometre by the API
 * client before it leaves the phone. Geocoding goes through GigSync's API, never to a map company from the phone.
 */

/** Why the phone gave no position: the owner said no (or the phone has location off), or it could not tell. */
export const LocateFailure = { denied: "denied", failed: "failed", off: "off" } as const;
export type LocateFailure = (typeof LocateFailure)[keyof typeof LocateFailure];

export class LocateError extends Error {
  constructor(readonly reason: LocateFailure) {
    super(`location ${reason}`);
  }
}

/** How long the phone may take, and how old a fix it may give: an area changes slowly. */
const LOCATE_TIMEOUT_MS = 15_000;
const FIX_MAX_AGE_MS = 5 * 60_000;
/** The Geolocation API's code for "the user said no". */
const PERMISSION_DENIED = 1;
/** The API answers this when geocoding is not set up on the server: the app offers typing instead. */
const GEOCODING_OFF = 503;

/** A fresh fix for an address: an old or cell-tower one can be a street or two out. */
const PRECISE_MAX_AGE_MS = 30_000;

/** The phone's position, once; `precise` for an address, coarse (and possibly a few minutes old) for an area. */
export function currentPoint(precise = false): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new LocateError(LocateFailure.failed));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => reject(new LocateError(err.code === PERMISSION_DENIED ? LocateFailure.denied : LocateFailure.failed)),
      {
        enableHighAccuracy: precise,
        timeout: LOCATE_TIMEOUT_MS,
        maximumAge: precise ? PRECISE_MAX_AGE_MS : FIX_MAX_AGE_MS,
      },
    );
  });
}

/** Geocoding is switched off on the server (no key yet), as opposed to failing this once. */
export const geocodingOff = (err: unknown): boolean => err instanceof HttpError && err.status === GEOCODING_OFF;

/** The places at the owner's point: their locality, city and PIN. */
export const placesAt = (session: Session, point: Place): Promise<GeoPlace[]> =>
  apiClient(session).reverseGeocode(point);

/** Places matching what the owner typed. */
export const placesNamed = (session: Session, q: string): Promise<GeoPlace[]> => apiClient(session).searchPlaces(q);
