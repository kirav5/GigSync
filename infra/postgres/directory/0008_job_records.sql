-- Job records on the server (ADR 0038): structured fields only, never free text, contact details, addresses or UPI
-- ids. Each side submits the job it signed with its signature over the terms hash; a job is stored only when both
-- sides' fields match and both signatures verify. Worker records on cards and per-worker analytics come from these
-- rows. Replaces ADR 0036's counting: engagement_signatures, engagement_reviews and the worker_profiles record_*
-- columns are no longer written or read from this release, and are dropped in a later migration once no deployed
-- code reads them. Consent uses the consents table from 0001, purpose 'job_records'.

-- Show my record (all or nothing), now a column: the record itself is computed, not published. Cards whose ADR 0036
-- record was empty (hidden, or nothing counted yet) start hidden, so nobody who hid it is shown by this migration;
-- the phone sends the switch with every publish.
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS show_record BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE worker_profiles SET show_record = FALSE WHERE record_jobs IS NULL;

-- One side's account of a job, kept until both sides match (state 'stored') or set aside when they differ
-- ('mismatch', never counted; either side may submit again). The evidence for a stored job: both signatures.
CREATE TABLE IF NOT EXISTS job_submissions (
  engagement_id  TEXT NOT NULL,              -- eng_<ulid>, chosen by the phones
  user_id        TEXT NOT NULL REFERENCES users (user_id),
  counterpart_id TEXT NOT NULL REFERENCES users (user_id),
  role           TEXT NOT NULL CHECK (role IN ('provider', 'requester')), -- the submitter's Role
  fields         TEXT NOT NULL,              -- canonical JSON of the job's structured fields (strict schema), no words
  terms_hash     TEXT NOT NULL,
  sig            TEXT NOT NULL,              -- Ed25519, base64, over "gigsync/agree/v1:" || terms_hash
  device_id      TEXT NOT NULL REFERENCES devices (device_id), -- the active device whose key verified sig
  state          TEXT NOT NULL CHECK (state IN ('pending', 'stored', 'mismatch')), -- a JobSubmitState
  submitted_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (engagement_id, user_id),
  CHECK (user_id <> counterpart_id)
);
-- Foreign keys, also serving deletion of everything involving one person.
CREATE INDEX IF NOT EXISTS job_submissions_user ON job_submissions (user_id);
CREATE INDEX IF NOT EXISTS job_submissions_counterpart ON job_submissions (counterpart_id);
CREATE INDEX IF NOT EXISTS job_submissions_device ON job_submissions (device_id);

-- A job both sides attested. Scope columns are the trade's ADR 0030 buckets (NULL where the trade has none); term
-- columns are the agreed terms (NULL where not part of the deal).
CREATE TABLE IF NOT EXISTS job_records (
  engagement_id     TEXT PRIMARY KEY,
  worker_id         TEXT NOT NULL REFERENCES users (user_id),
  household_id      TEXT REFERENCES users (user_id), -- NULL once the household deleted its records (ADR 0038 §5)
  trade             TEXT NOT NULL,                   -- a Trade
  scope_problem     TEXT,                            -- electrician, plumber, carpenter, AC: the problem bucket
  scope_rooms       TEXT,                            -- maid, painter: RoomsBucket
  scope_frequency   TEXT,                            -- maid: MaidFrequency
  scope_people      TEXT,                            -- cook: PeopleBand
  scope_meals       TEXT,                            -- cook: MealsBucket
  scope_hours_band  TEXT,                            -- driver: HoursBand
  scope_labour_only BOOLEAN,                         -- painter: the household buys the paint
  work_day          DATE,                            -- the agreed day, when one was agreed
  work_daily        BOOLEAN NOT NULL DEFAULT FALSE,  -- recurring every day (when.day = "daily")
  work_window       TEXT CHECK (work_window IN ('morning', 'afternoon', 'evening')),
  materials_by      TEXT CHECK (materials_by IN ('worker', 'household')),
  coats             SMALLINT CHECK (coats BETWEEN 1 AND 3),
  hours_per_day     SMALLINT CHECK (hours_per_day BETWEEN 1 AND 12),
  price_paise       INTEGER NOT NULL CHECK (price_paise > 0),
  terms_hash        TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('agreed', 'done', 'cancelled')), -- a JobRecordStatus
  agreed_at         TIMESTAMPTZ NOT NULL,            -- when the second matching submission arrived
  done_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  stars             SMALLINT CHECK (stars BETWEEN 1 AND 5), -- the household's; one job has one household
  rated_at          TIMESTAMPTZ,
  CHECK (worker_id <> household_id),
  CHECK ((stars IS NULL) = (rated_at IS NULL))
);
-- A worker's record on every served card, and her export and deletion.
CREATE INDEX IF NOT EXISTS job_records_worker ON job_records (worker_id, status);
-- The foreign key: a household's export, deletion, and "came back" counts.
CREATE INDEX IF NOT EXISTS job_records_household ON job_records (household_id);

-- Payments on a stored job: amount, day and method, never a UPI reference. Who reported it is kept as a side, not an
-- id, so a household's deletion leaves nothing of it here. Only confirmed payments count as revenue.
CREATE TABLE IF NOT EXISTS job_payments (
  payment_id    TEXT PRIMARY KEY,                    -- pay_<ulid>, chosen by the phones
  engagement_id TEXT NOT NULL REFERENCES job_records (engagement_id),
  amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
  paid_on       DATE NOT NULL,
  method        TEXT NOT NULL CHECK (method IN ('upi', 'cash')), -- a PaymentMethod
  reported_by   TEXT NOT NULL CHECK (reported_by IN ('worker', 'household')),
  reported_at   TIMESTAMPTZ NOT NULL,
  confirmed_at  TIMESTAMPTZ                          -- set when the worker (the payee) reported or confirmed it
);
-- The foreign key; serves "payments of these jobs".
CREATE INDEX IF NOT EXISTS job_payments_engagement ON job_payments (engagement_id);

-- Submissions and star replacements are rate limited too (a RateAction in workers/api).
ALTER TABLE rate_windows DROP CONSTRAINT IF EXISTS rate_windows_action_check;
ALTER TABLE rate_windows ADD CONSTRAINT rate_windows_action_check
  CHECK (action IN ('transfer', 'job_submit', 'stars'));
