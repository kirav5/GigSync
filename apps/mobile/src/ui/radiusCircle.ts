import type { Place } from "@gigsync/protocol";

/** The Earth's mean radius, for drawing a circle of so many kilometres on the map. */
const EARTH_KM = 6371;
/** Enough corners that the circle looks round at any zoom. */
const SIDES = 72;
const DEGREES = 180;
const FULL_TURN = 2 * Math.PI;
const rad = (deg: number) => (deg * Math.PI) / DEGREES;
const deg = (r: number) => (r * DEGREES) / Math.PI;

/** The point `km` away from `at` in the direction `bearing` (radians), on a sphere. */
function destination(at: Place, km: number, bearing: number): [number, number] {
  const d = km / EARTH_KM;
  const lat1 = rad(at.lat);
  const lon1 = rad(at.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
  const lon2 =
    lon1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [deg(lon2), deg(lat2)];
}

/** A closed ring of [lon, lat] points `km` around `at`: the circle the distance map draws. */
export function circleRing(at: Place, km: number): [number, number][] {
  const ring = Array.from({ length: SIDES }, (_, i) => destination(at, km, (i / SIDES) * FULL_TURN));
  const first = ring[0];
  return first ? [...ring, first] : ring;
}

/** The circle as a GeoJSON polygon feature, for a map source. */
export const circleFeature = (at: Place, km: number) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "Polygon" as const, coordinates: [circleRing(at, km)] },
});

/** The circle's bounding box as [[west, south], [east, north]], for the map to fit it. */
export function circleBounds(at: Place, km: number): [[number, number], [number, number]] {
  const ring = circleRing(at, km);
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
