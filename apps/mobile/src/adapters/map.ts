import { BEARER_PREFIX, Header, log } from "@gigsync/core";
import type { Place, Session } from "@gigsync/protocol";
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

/**
 * Directions in the phone's maps app (Google Maps opens its app where installed, else the web): to the pinned door,
 * or to the address as written when the household never pinned it, which the maps app looks up itself.
 */
const DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=";
export const directionsTo = (to: Place | string): string =>
  `${DIRECTIONS}${typeof to === "string" ? encodeURIComponent(to) : `${to.lat},${to.lon}`}`;
const MARKER_CLASS = "place-map-marker";

/** The signed-in owner's session, set by the app shell; maps are drawn only while someone is signed in. */
let mapSession: Session | undefined;
export const setMapSession = (session: Session | undefined): void => {
  mapSession = session;
};

/** The style, kept once fetched for this session; a failure (no key on the server, offline) is asked again next time. */
let kept: { token: string; style: StyleSpecification } | undefined;
async function styleOf(session: Session): Promise<StyleSpecification | undefined> {
  if (kept?.token === session.token) return structuredClone(kept.style);
  const auth = { [Header.authorization]: `${BEARER_PREFIX}${session.token}` };
  const res = await fetch(`${API_BASE}${STYLE_PATH}`, { headers: auth });
  if (!res.ok) return undefined;
  kept = { token: session.token, style: (await res.json()) as StyleSpecification };
  return structuredClone(kept.style);
}

/** Whether a map can be drawn now: someone is signed in and the API serves the map. */
export async function mapsAvailable(): Promise<boolean> {
  const session = mapSession;
  if (!API_BASE || !session) return false;
  return styleOf(session).then(
    (style) => style !== undefined,
    () => false,
  );
}

/**
 * A map in `container`, or undefined when there is none to draw. With `mark`, the place is marked on the map itself,
 * so it stays put while the owner moves and zooms around it, with zoom buttons for a phone held in one hand.
 */
export async function openMap(
  container: HTMLElement,
  options: Omit<MapOptions, "container" | "style">,
  mark?: Place,
): Promise<MapLibreMap | undefined> {
  const session = mapSession;
  if (!API_BASE || !session) return undefined;
  const auth = { [Header.authorization]: `${BEARER_PREFIX}${session.token}` };
  try {
    const style = await styleOf(session);
    if (!style) return undefined;
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
    if (mark) {
      const pin = Object.assign(document.createElement("span"), { className: MARKER_CLASS });
      new maplibre.Marker({ element: pin, anchor: "bottom" }).setLngLat([mark.lon, mark.lat]).addTo(map);
      map.addControl(new maplibre.NavigationControl({ showCompass: false }));
    }
    return map;
  } catch (err) {
    log.debug("map: not drawn", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}
