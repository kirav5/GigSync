-- Cities and areas served (ADR 0061): kept here so a new city is rows, not a release. A place is served inside a live
-- city's circle (centre and radius_km); its areas are the neighbourhoods Find names and prices by. Seeded with
-- Bengaluru and the pilot's five areas, as the code had them, so nothing changes for anyone today.

CREATE TABLE IF NOT EXISTS cities (
  city_key  TEXT PRIMARY KEY CHECK (city_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name_en   TEXT NOT NULL,
  name_hi   TEXT NOT NULL,
  name_kn   TEXT NOT NULL,
  state     TEXT NOT NULL,                    -- for the state's minimum wages and rate card
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL CHECK (radius_km > 0 AND radius_km <= 80),
  live      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS city_areas (
  city_key  TEXT NOT NULL REFERENCES cities (city_key) ON DELETE CASCADE,
  area_key  TEXT NOT NULL CHECK (area_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name_en   TEXT NOT NULL,
  name_hi   TEXT NOT NULL,
  name_kn   TEXT NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  live      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (city_key, area_key)
);

INSERT INTO cities (city_key, name_en, name_hi, name_kn, state, lat, lon, radius_km)
VALUES ('bengaluru', 'Bengaluru', 'बेंगलुरु', 'ಬೆಂಗಳೂರು', 'karnataka', 12.9767, 77.5713, 30)
ON CONFLICT (city_key) DO NOTHING;

INSERT INTO city_areas (city_key, area_key, name_en, name_hi, name_kn, lat, lon) VALUES
  ('bengaluru', 'indiranagar', 'Indiranagar', 'इंदिरानगर', 'ಇಂದಿರಾನಗರ', 12.9719, 77.6412),
  ('bengaluru', 'koramangala', 'Koramangala', 'कोरमंगला', 'ಕೋರಮಂಗಲ', 12.9352, 77.6245),
  ('bengaluru', 'hsr_layout', 'HSR Layout', 'एचएसआर लेआउट', 'ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್', 12.9116, 77.6474),
  ('bengaluru', 'jayanagar', 'Jayanagar', 'जयनगर', 'ಜಯನಗರ', 12.9308, 77.5838),
  ('bengaluru', 'whitefield', 'Whitefield', 'व्हाइटफ़ील्ड', 'ವೈಟ್‌ಫೀಲ್ಡ್', 12.9698, 77.75)
ON CONFLICT (city_key, area_key) DO NOTHING;
