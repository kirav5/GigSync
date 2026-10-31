-- Mentors for workers new to a city (agent-flows §2, without a union gate). A worker whose own record shows enough
-- both-signed jobs lists themselves; a newcomer browses matches by fixed rules and picks. No phone, no address, no
-- message content: contact happens only through sealed envelopes once both sides accept.

CREATE TABLE IF NOT EXISTS mentor_listings (
  user_id              TEXT PRIMARY KEY REFERENCES users (user_id),
  first_name           TEXT NOT NULL,
  city                 TEXT NOT NULL,             -- a City from @gigsync/protocol, validated by MentorListing
  area                 TEXT NOT NULL,             -- a neighbourhood name, about a kilometre; never an address
  months               INTEGER NOT NULL CHECK (months >= 0), -- the mentor's own count from their phone
  jobs                 INTEGER NOT NULL CHECK (jobs >= 0),   -- likewise; shown as "says {jobs} jobs"
  open_slots           INTEGER NOT NULL CHECK (open_slots >= 0),
  -- Self-declared, used only as a matching filter and never returned to anyone else.
  woman                BOOLEAN NOT NULL,
  -- A woman mentor who takes only women newcomers; ignored unless woman is true.
  women_only_newcomers BOOLEAN NOT NULL DEFAULT false,
  active               BOOLEAN NOT NULL DEFAULT true,
  -- The union or NGO that vouches for this mentor. Set only through the admin route; publishing keeps it.
  vouched_by           TEXT,
  updated_at           TIMESTAMPTZ NOT NULL
);
-- Matching starts from the city, among listings that can take someone now, most jobs first.
CREATE INDEX IF NOT EXISTS mentor_listings_match ON mentor_listings (city, jobs DESC)
  WHERE active AND open_slots > 0;

CREATE TABLE IF NOT EXISTS mentor_trades (
  user_id TEXT NOT NULL REFERENCES mentor_listings (user_id) ON DELETE CASCADE,
  trade   TEXT NOT NULL,                          -- a Trade from @gigsync/protocol
  PRIMARY KEY (user_id, trade)
);
CREATE INDEX IF NOT EXISTS mentor_trades_trade ON mentor_trades (trade, user_id);

CREATE TABLE IF NOT EXISTS mentor_languages (
  user_id  TEXT NOT NULL REFERENCES mentor_listings (user_id) ON DELETE CASCADE,
  language TEXT NOT NULL,                         -- a Lang from @gigsync/protocol
  PRIMARY KEY (user_id, language)
);
CREATE INDEX IF NOT EXISTS mentor_languages_language ON mentor_languages (language, user_id);

-- One report per reporter and person; reporting again replaces the reason and reopens it. Reports outlive a deleted
-- listing on purpose, so switching off and on again does not clear them.
CREATE TABLE IF NOT EXISTS mentor_reports (
  reporter_id TEXT NOT NULL REFERENCES users (user_id),
  reported_id TEXT NOT NULL REFERENCES users (user_id),
  reason      TEXT NOT NULL,                      -- a ReportReason from @gigsync/protocol
  created_at  TIMESTAMPTZ NOT NULL,
  -- Set by whoever reviews the report; until then it counts toward leaving the person out of matching.
  reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (reporter_id, reported_id),
  CHECK (reporter_id <> reported_id)
);
-- Counting open reports against one person, for every listing a match considers.
CREATE INDEX IF NOT EXISTS mentor_reports_reported ON mentor_reports (reported_id) WHERE reviewed_at IS NULL;

-- Never match these two again, whichever of them blocked the other.
CREATE TABLE IF NOT EXISTS mentor_blocks (
  blocker_id TEXT NOT NULL REFERENCES users (user_id),
  blocked_id TEXT NOT NULL REFERENCES users (user_id),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
-- The primary key serves "whom did the caller block"; this serves "who blocked the caller".
CREATE INDEX IF NOT EXISTS mentor_blocks_blocked ON mentor_blocks (blocked_id, blocker_id);
