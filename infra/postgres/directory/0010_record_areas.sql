-- Market prices from job records (ADR 0039 §1): an estimate is computed first from agreed prices in job_records, per
-- trade and scope bucket, in the job's area and then across the city. A record now carries the job's area: the pilot
-- area's slug ("jayanagar", "hsr-layout") that both phones derive from the request's approximate point, never an
-- address. Older records have none and count only city-wide.
--
-- City: job_records carry no city, because City has one value (bengaluru) and every record is in it. A second city
-- needs a city column here before its records can be told apart (a test in workers/api guards this).
--
-- ADR 0030 §3's opt-in sharing ends with this release: shared_prices and price_share_counts are no longer written or
-- read, and are dropped in a later migration once no deployed code reads them.

ALTER TABLE job_records ADD COLUMN IF NOT EXISTS area_key TEXT; -- an AreaKey slug; NULL when the job was in no pilot area

-- The market query: one trade's jobs over the last twelve months, in one area or the whole city.
CREATE INDEX IF NOT EXISTS job_records_market ON job_records (trade, area_key, agreed_at);
