-- How people use Find, as bare counts per day (ADR 0060): typed or tapped, and how often the work was corrected. The
-- table holds no user, no words and no work, by design: it can say how Find is used and nothing about anyone.

CREATE TABLE IF NOT EXISTS find_counts (
  day   DATE NOT NULL,   -- the day in India
  event TEXT NOT NULL,   -- a FindEvent, checked by the API
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);
