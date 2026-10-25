-- The job board (LLD §7.5): the public card a worker publishes so consumers' agents can find them. Approximate area
-- only (rounded to about a kilometre by the API); no phone, no address. Contact details travel only inside sealed
-- envelopes after both sides sign a job.

CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id      TEXT PRIMARY KEY REFERENCES users (user_id),
  display_name TEXT NOT NULL,
  area_lat     DOUBLE PRECISION NOT NULL CHECK (area_lat BETWEEN -90 AND 90),
  area_lon     DOUBLE PRECISION NOT NULL CHECK (area_lon BETWEEN -180 AND 180),
  area_name    TEXT NOT NULL,
  rate_paise   INTEGER NOT NULL CHECK (rate_paise > 0), -- the usual visit rate; the private minimum stays on the phone
  about        TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL
);
-- Serves the latitude band that narrows a distance search before the exact distance is computed.
CREATE INDEX IF NOT EXISTS worker_profiles_lat ON worker_profiles (area_lat);

CREATE TABLE IF NOT EXISTS worker_trades (
  user_id TEXT NOT NULL REFERENCES worker_profiles (user_id) ON DELETE CASCADE,
  trade   TEXT NOT NULL,                     -- a Trade from @gigsync/protocol, validated by BoardProfile
  PRIMARY KEY (user_id, trade)
);
-- Search starts from the trade: "every electrician".
CREATE INDEX IF NOT EXISTS worker_trades_trade ON worker_trades (trade, user_id);

CREATE TABLE IF NOT EXISTS worker_languages (
  user_id  TEXT NOT NULL REFERENCES worker_profiles (user_id) ON DELETE CASCADE,
  language TEXT NOT NULL,                    -- ISO 639-1
  PRIMARY KEY (user_id, language)
);
