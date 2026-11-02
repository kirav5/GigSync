-- Work arrangements (ADR 0046): maid and driver work by the hour, the visit, the week or the month.
--
-- A worker's card lists the arrangements they take, each with its usual rate; their lowest rates stay on their phone.
-- A card with no rows here takes monthly work only, as every card did before. Rows go with the card (CASCADE).

CREATE TABLE IF NOT EXISTS worker_arrangements (
  user_id     TEXT NOT NULL REFERENCES worker_profiles (user_id) ON DELETE CASCADE,
  arrangement TEXT NOT NULL CHECK (arrangement IN ('hourly', 'visit', 'weekly', 'monthly')), -- an Arrangement
  rate_paise  INTEGER NOT NULL CHECK (rate_paise > 0),
  PRIMARY KEY (user_id, arrangement)
);
-- Search filters by arrangement after the trade: "maids near here who take hourly work".
CREATE INDEX IF NOT EXISTS worker_arrangements_arrangement ON worker_arrangements (arrangement, user_id);

-- A job record keeps how long the job was for, so GigSync's own per-unit rates compare hours with hours and months
-- with months. NULL for every record stored before this migration and from phones that send none: monthly.
ALTER TABLE job_records
  ADD COLUMN IF NOT EXISTS qty_arrangement TEXT CHECK (qty_arrangement IN ('hourly', 'visit', 'weekly', 'monthly'));
