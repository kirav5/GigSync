-- Kanpur joins the pilot (ADR 0061), with Kalyanpur as its first area. Served within 25 km of the city centre. Kanpur has
-- no rate card yet: its households see no price until its own agreed jobs give one. Re-running changes nothing.

INSERT INTO cities (city_key, name_en, name_hi, name_kn, state, lat, lon, radius_km)
VALUES ('kanpur', 'Kanpur', 'कानपुर', 'ಕಾನ್ಪುರ', 'uttar_pradesh', 26.4499, 80.3319, 25)
ON CONFLICT (city_key) DO NOTHING;

INSERT INTO city_areas (city_key, area_key, name_en, name_hi, name_kn, lat, lon) VALUES
  ('kanpur', 'kalyanpur', 'Kalyanpur', 'कल्याणपुर', 'ಕಲ್ಯಾಣಪುರ', 26.5113, 80.2329)
ON CONFLICT (city_key, area_key) DO NOTHING;
