import { BEARER_PREFIX, Header, log } from "@gigsync/core";
import type { Session } from "@gigsync/protocol";
import type { Map as MapLibreMap, MapOptions, StyleSpecification } from "maplibre-gl";
import { API_BASE } from "./api.js";

/**
 * The map (ADR 0050 §7): MapLibre, loaded only when a map is shown, drawing Ola's map through GigSync's API. Every
 * request the map makes to our API carries the owner's session; none goes to Ola from the phone. Without the API's
 * key (503) or any other failure, there is no map, and the screens work as they do without one.
 */

const MAP_ROUTE = "/v1/geo/map/";
const STYLE_PATH = `${MAP_ROUTE}style.json`;

/**
 * A link in the style to our map route, on this phone's API. The API writes its links with the host it was asked on,
 * which is not always the one the phone uses (`wrangler dev` answers as the production host).
 */
const onOurApi = (url: string): string | undefined => {
  const at = url.indexOf(MAP_ROUTE);
  return at < 0 ? undefined : `${API_BASE}${url.slice(at)}`;
};

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
    const map = new maplibre.Map({
      ...options,
      container,
      style,
      attributionControl: { compact: true },
      // Our own API only: its links in the style are ours, and need the session.
      transformRequest: (url) => {
        const ours = onOurApi(url);
        return ours ? { url: ours, headers: auth } : { url };
      },
    });
    // A missing tile, or a layer Ola's style names that its data lacks (its 3D buildings): the rest still draws.
    map.on("error", (e) => log.debug("map: part not drawn", { error: e.error?.message }));
    return map;
  } catch (err) {
    log.debug("map: not drawn", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}
