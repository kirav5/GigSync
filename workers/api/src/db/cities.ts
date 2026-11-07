import type { CityUpsert, ServedCity } from "@gigsync/protocol";
import type { Db } from "./client.js";

interface CityRow {
  city_key: string;
  name_en: string;
  name_hi: string;
  name_kn: string;
  state: string;
  lat: number;
  lon: number;
  radius_km: number;
  areas: { key: string; en: string; hi: string; kn: string; lat: number; lon: number }[] | null;
}

/** The live cities, each with its live areas, by name. */
export async function liveCities(db: Db): Promise<ServedCity[]> {
  const { rows } = await db.query<CityRow>(
    `SELECT c.city_key, c.name_en, c.name_hi, c.name_kn, c.state, c.lat, c.lon, c.radius_km,
       (SELECT json_agg(json_build_object('key', a.area_key, 'en', a.name_en, 'hi', a.name_hi, 'kn', a.name_kn,
          'lat', a.lat, 'lon', a.lon) ORDER BY a.name_en)
        FROM city_areas a WHERE a.city_key = c.city_key AND a.live) AS areas
     FROM cities c WHERE c.live ORDER BY c.name_en`,
  );
  return rows.map((r) => ({
    key: r.city_key,
    names: { en: r.name_en, hi: r.name_hi, kn: r.name_kn },
    state: r.state,
    centre: { lat: r.lat, lon: r.lon },
    radius_km: r.radius_km,
    areas: (r.areas ?? []).map((a) => ({
      key: a.key,
      names: { en: a.en, hi: a.hi, kn: a.kn },
      centre: { lat: a.lat, lon: a.lon },
    })),
  }));
}

/** Adds or changes a city and its areas; areas not listed are taken off, never deleted. Call in a transaction. */
export async function upsertCity(db: Db, c: CityUpsert): Promise<void> {
  await db.query(
    `INSERT INTO cities (city_key, name_en, name_hi, name_kn, state, lat, lon, radius_km, live)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (city_key) DO UPDATE SET name_en = $2, name_hi = $3, name_kn = $4, state = $5, lat = $6, lon = $7,
       radius_km = $8, live = $9`,
    [c.key, c.names.en, c.names.hi, c.names.kn, c.state, c.centre.lat, c.centre.lon, c.radius_km, c.live],
  );
  await db.query("UPDATE city_areas SET live = FALSE WHERE city_key = $1", [c.key]);
  for (const a of c.areas)
    await db.query(
      `INSERT INTO city_areas (city_key, area_key, name_en, name_hi, name_kn, lat, lon, live)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (city_key, area_key) DO UPDATE SET name_en = $3, name_hi = $4, name_kn = $5, lat = $6, lon = $7,
         live = TRUE`,
      [c.key, a.key, a.names.en, a.names.hi, a.names.kn, a.centre.lat, a.centre.lon],
    );
}
