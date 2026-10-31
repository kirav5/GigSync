-- A worker's record on their card (ADR 0036): the phone publishes jobs, ratings and returning households; the server
-- serves each count capped at what it saw delivered. Counted from envelope headers only (kind, engagement, from, to) as
-- the mailbox route stores them: never content, stars or terms. Never used to sort, filter or rank workers.

-- The record as the worker's phone publishes it with their card. All NULL when the worker hides it or published none.
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS record_jobs           INTEGER CHECK (record_jobs >= 0),
  ADD COLUMN IF NOT EXISTS record_rated          INTEGER CHECK (record_rated >= 0),
  ADD COLUMN IF NOT EXISTS record_average_tenths SMALLINT CHECK (record_average_tenths BETWEEN 10 AND 50), -- stars x 10
  ADD COLUMN IF NOT EXISTS record_came_back      INTEGER CHECK (record_came_back >= 0);
ALTER TABLE worker_profiles DROP CONSTRAINT IF EXISTS worker_profiles_record_whole;
ALTER TABLE worker_profiles ADD CONSTRAINT worker_profiles_record_whole CHECK (
  (record_jobs IS NULL) = (record_rated IS NULL) AND (record_jobs IS NULL) = (record_came_back IS NULL)
  AND (record_average_tenths IS NULL OR record_jobs IS NOT NULL));

-- One row per `agree` (a signature on the terms) a user delivered to another on one engagement. The pair is kept, not
-- just a count, because a job counts only once both sides signed and "came back" needs the household; the primary key
-- makes a retried or duplicated envelope a no-op.
CREATE TABLE IF NOT EXISTS engagement_signatures (
  signer_id      TEXT NOT NULL REFERENCES users (user_id),
  counterpart_id TEXT NOT NULL REFERENCES users (user_id),
  engagement_id  TEXT NOT NULL,              -- eng_<ulid>, chosen by the phones; no engagements table on the server
  PRIMARY KEY (signer_id, counterpart_id, engagement_id),
  CHECK (signer_id <> counterpart_id)        -- a job with yourself is no job
);
-- The foreign key; the primary key already serves "this signer's signatures" and the other side's matching row.
CREATE INDEX IF NOT EXISTS engagement_signatures_counterpart ON engagement_signatures (counterpart_id);

-- Engagements both sides signed, once from each side's point of view: user_id signed with counterpart_id.
CREATE OR REPLACE VIEW signed_engagements AS
  SELECT a.signer_id AS user_id, a.counterpart_id, a.engagement_id
  FROM engagement_signatures a
  JOIN engagement_signatures b
    ON b.signer_id = a.counterpart_id AND b.counterpart_id = a.signer_id AND b.engagement_id = a.engagement_id;

-- One row per review a user delivered about another on an engagement both had signed when it arrived: one per
-- reviewer per engagement, whatever the retries. The stars stay sealed; only that a review arrived is kept.
CREATE TABLE IF NOT EXISTS engagement_reviews (
  subject_id    TEXT NOT NULL REFERENCES users (user_id),
  reviewer_id   TEXT NOT NULL REFERENCES users (user_id),
  engagement_id TEXT NOT NULL,
  PRIMARY KEY (subject_id, reviewer_id, engagement_id),
  CHECK (subject_id <> reviewer_id)
);
-- The foreign key; the primary key serves "reviews of this worker".
CREATE INDEX IF NOT EXISTS engagement_reviews_reviewer ON engagement_reviews (reviewer_id);
