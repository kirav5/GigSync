import { BEARER_PREFIX, Header, log } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import type { Map as MapLibreMap, MapOptions, StyleSpecification } from "maplibre-gl";
import { API_BASE } from "./api.js";

/**
 * The map (ADR 0050 §7): MapLibre, loaded only when a map is shown, drawing Ola's map through GigSync's API. Every
 * request the map makes to our API carries the owner's session; none goes to Ola from the phone. Without the API's
 * key (503) or any other failure, there is no map, and the screens work as they do without one.
 */

const STYLE_PATH = "/v1/geo/map/style.json";

/** The signed-in owner's session, set by the app shell; maps are drawn only while someone is signed in. */
let mapSession: Session | undefined;
export const setMapSession = (session: Session | undefined): void => {
  mapSession = session;
};

/** A map in `container`, or undefined when there is none to draw. */
export async function openMap(
  container: HTMLElement,
  options: Omit<MapOptions, "container" | "style">,
): Promise<MapLibreMap | undefined> {
  const session = mapSession;
  if (!API_BASE || !session) return undefined;
  const auth = { [Header.authorization]: `${BEARER_PREFIX}${session.token}` };
  try {
    const res = await fetch(`${API_BASE}${STYLE_PATH}`, { headers: auth });
    if (!res.ok) return undefined;
    const style = (await res.json()) as StyleSpecification;
    const [maplibre] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
    return new maplibre.Map({
      ...options,
      container,
      style,
      attributionControl: { compact: true },
      // Our own API only: its links in the style are ours, and need the session.
      transformRequest: (url) => (url.startsWith(API_BASE ?? "") ? { url, headers: auth } : { url }),
    });
  } catch (err) {
    log.debug("map: not drawn", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}
