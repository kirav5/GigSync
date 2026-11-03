-- Working hours on the card (ADR 0050 §2): the weekdays (1 Monday … 7 Sunday) and parts of the day a worker works,
-- as a shop shows its hours, so a search for a day and a time leaves out workers who do not work then. NULL in both
-- means any day, any time: every card stored before this migration, and every card that does not say.
-- A worker's bookings and jobs are not here; they stay on their phone (ADR 0048).

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS work_days SMALLINT[] CHECK (work_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]),
  ADD COLUMN IF NOT EXISTS work_windows TEXT[] CHECK (work_windows <@ ARRAY['morning', 'afternoon', 'evening']::TEXT[]);

-- Search leaves out a worker with a signed job on the asked day and part of the day: their agreed jobs by worker.
CREATE INDEX IF NOT EXISTS job_records_worker_agreed ON job_records (worker_id, work_day, work_window)
  WHERE status = 'agreed';
