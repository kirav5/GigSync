-- Start hours (ADR 0053 §1): a worker's working hours on the clock, and the hour an agreed job starts, so a search for
-- an hour matches by the hour rather than by the part of the day.
--
-- work_from–work_to: the hours of the day a worker works (9–18 is 9 am to 6 pm), within one day; both or neither.
-- NULL in both means as before: the card's work_windows decide, or any time when those are NULL too.
-- work_hour: the hour on the phone's clock an agreed job starts, from its terms' when.hour. NULL means as before: the
-- job is placed by its work_window only. A job's length is its hours_per_day, or DEFAULT_JOB_HOURS when it has none.

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS work_from SMALLINT CHECK (work_from BETWEEN 0 AND 23), -- a StartHour
  ADD COLUMN IF NOT EXISTS work_to SMALLINT CHECK (work_to BETWEEN 1 AND 24),     -- at most DAY_HOURS
  ADD CONSTRAINT worker_profiles_work_from_to_check
    CHECK ((work_from IS NULL) = (work_to IS NULL) AND (work_from IS NULL OR work_from < work_to));

ALTER TABLE job_records
  ADD COLUMN IF NOT EXISTS work_hour SMALLINT CHECK (work_hour BETWEEN 0 AND 23); -- a StartHour
