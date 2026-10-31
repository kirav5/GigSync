-- Rate estimates (ADR 0030): what the web says a job costs, cached per city, trade and scope bucket, and prices
-- GigSync users chose to share, stored with no user. Nothing here is a person's words, contact or exact date.

-- One row per job type. A disposable cache, always read and replaced whole, so the quotes it rests on stay a JSON list
-- next to the figures rather than child rows.
CREATE TABLE IF NOT EXISTS estimate_cache (
  city            TEXT NOT NULL,             -- a City from @gigsync/protocol
  trade           TEXT NOT NULL,             -- a Trade from @gigsync/protocol
  bucket          TEXT NOT NULL,             -- the scope buckets, "key=value;..." sorted by key
  -- The web quotes' 25th, 50th and 75th percentiles in paise, unrounded, and how many quotes they rest on. NULL when
  -- the web gave too few quotes (none_reason says so) or before the first reading finishes.
  low_paise       INTEGER CHECK (low_paise > 0),
  typical_paise   INTEGER CHECK (typical_paise > 0),
  high_paise      INTEGER CHECK (high_paise > 0),
  quote_count     INTEGER CHECK (quote_count > 0),
  quotes          JSONB NOT NULL DEFAULT '[]', -- EstimateSource[]: url, site, sentence, amount_paise, unit
  none_reason     TEXT,                      -- a NoEstimateReason, cached like an estimate so a thin job is not re-read
  read_at         TIMESTAMPTZ,               -- when the web was read; NULL until the first reading finishes
  -- Set while one request reads the web for this row, so a burst of requests runs one reading. A reading older than
  -- the lock's lifetime (in code) is taken as dead.
  computing_since TIMESTAMPTZ,
  PRIMARY KEY (city, trade, bucket),
  CHECK ((low_paise IS NULL) = (high_paise IS NULL) AND (low_paise IS NULL) = (typical_paise IS NULL)
    AND (low_paise IS NULL) = (quote_count IS NULL)),
  CHECK (read_at IS NULL OR low_paise IS NOT NULL OR none_reason IS NOT NULL)
);

-- Shared prices: no user id, no exact date (a month), a neighbourhood slug rather than a place. The id is random, not
-- a ULID, so it carries no time. Read only in aggregate, and only once K_MIN (in code) exist for a bucket.
CREATE TABLE IF NOT EXISTS shared_prices (
  price_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT NOT NULL,                 -- a City from @gigsync/protocol
  trade       TEXT NOT NULL,                 -- a Trade from @gigsync/protocol
  bucket      TEXT NOT NULL,                 -- as in estimate_cache
  area_key    TEXT NOT NULL,                 -- an AreaKey slug; kept for later per-area estimates
  price_paise INTEGER NOT NULL CHECK (price_paise > 0),
  month       DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1) -- the first of the month the job was agreed
);
-- An estimate reads one bucket's recent months.
CREATE INDEX IF NOT EXISTS shared_prices_bucket ON shared_prices (city, trade, bucket, month);

-- How many prices one user shared today, so one person cannot flood a bucket. Holds a count, never a price; a user's
-- older days are deleted when they next share, so there is at most one row per user.
CREATE TABLE IF NOT EXISTS price_share_counts (
  user_id TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  shares  INTEGER NOT NULL CHECK (shares > 0),
  PRIMARY KEY (user_id, day)
);
