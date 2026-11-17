import type { PlaceKey } from "@gigsync/protocol";

/**
 * Which cities are live: the Worker's `LIVE_CITIES` setting over the directory's live cities (ADR 0061). Unset, the
 * directory alone decides; a comma list keeps only those cities; `*` keeps them all and lets every other place in too,
 * for development and testing from anywhere. Places outside the live cities then get no rate card or guide.
 */

/** The setting that lets every place in. */
export const ANYWHERE = "*";
const SEPARATOR = ",";

/** The setting read: every place, or only the directory's live cities (all of them, or those named). */
export type LiveCities =
  | { readonly anywhere: true }
  | { readonly anywhere: false; readonly only?: ReadonlySet<PlaceKey> | undefined };

/** Reads `LIVE_CITIES`: blank or unset leaves the directory's list as it is. Keys are compared in lower case. */
export function parseLiveCities(value: string | undefined): LiveCities {
  const keys = (value ?? "")
    .split(SEPARATOR)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keys.includes(ANYWHERE)) return { anywhere: true };
  return { anywhere: false, only: keys.length > 0 ? new Set(keys) : undefined };
}

/** Whether a directory city stays live under the setting. */
export const isLiveCity = (live: LiveCities, key: PlaceKey): boolean =>
  live.anywhere || live.only === undefined || live.only.has(key);
