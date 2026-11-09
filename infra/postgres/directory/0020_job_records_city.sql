-- Each job record's city (ADR 0061), so a city's prices come from its own jobs. Every record so far is Bengaluru's,
-- the one city served until now: the column's default fills them as it is added. A new record takes the live city
-- whose circle holds the worker's card (db/job-records.ts), else this default.

ALTER TABLE job_records ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'bengaluru';

-- The market query, now within one city: one trade's jobs over the last twelve months.
CREATE INDEX IF NOT EXISTS job_records_city_market ON job_records (trade, city, agreed_at);
