/** Earth's mean radius, for exact (haversine) distances in SQL. */
export const EARTH_RADIUS_KM = 6371;
/**
 * Kilometres per degree of latitude, for the cheap band that narrows a search before exact distances. A little under
 * the 111.19 the radius above gives, so the band is a little wider than the circle and never cuts into it.
 */
export const KM_PER_DEGREE = 111;

const HALF_TURN_DEGREES = 180;
const QUARTER_TURN_RADIANS = Math.PI / 2;
const EVERY_LONGITUDE: LonBand = { west: -HALF_TURN_DEGREES, east: HALF_TURN_DEGREES };

const radians = (degrees: number) => (degrees * Math.PI) / HALF_TURN_DEGREES;
const degrees = (rad: number) => (rad * HALF_TURN_DEGREES) / Math.PI;

/** The longitudes a search circle can touch, as bounds for `area_lon BETWEEN west AND east`. */
export interface LonBand {
  west: number;
  east: number;
}

/**
 * The longitude band of a circle of `radiusKm` around a point: the companion of the latitude band, so a search stops
 * at the circle's east and west edges too and not only its north and south ones.
 *
 * A degree of longitude shrinks with cos(latitude), and the circle is widest a little poleward of its centre, so the
 * half-width is asin(sin(reach) / cos(lat)) and not simply reach / cos(lat), which would cut into the circle. Where
 * that has no answer (the circle holds a pole) or the band would cross the ±180° line, every longitude is allowed:
 * the exact distance still decides, only without the shortcut.
 */
export function lonBand(lat: number, lon: number, radiusKm: number): LonBand {
  const reach = radians(radiusKm / KM_PER_DEGREE);
  const ratio = Math.sin(reach) / Math.cos(radians(lat));
  // Also true when the ratio is not a number at all.
  if (reach >= QUARTER_TURN_RADIANS || !(ratio < 1)) return EVERY_LONGITUDE;
  const halfWidth = degrees(Math.asin(ratio));
  const band = { west: lon - halfWidth, east: lon + halfWidth };
  return band.west < EVERY_LONGITUDE.west || band.east > EVERY_LONGITUDE.east ? EVERY_LONGITUDE : band;
}
