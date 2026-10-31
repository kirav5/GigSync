-- Personal QR codes (ADR 0034): every worker and household can show a QR that finds them. The QR is a link with a
-- short random code, never a user id; the owner can replace the code, which ends the old one. A scanned household shows
-- only its first name; a scanned worker shows their board card (worker_profiles). No phone, no address, no content.

-- What a person's QR shows besides a worker's board card: their role and the first name they chose for it.
CREATE TABLE IF NOT EXISTS qr_owners (
  user_id    TEXT PRIMARY KEY REFERENCES users (user_id),
  role       TEXT NOT NULL CHECK (role IN ('worker', 'household')), -- a QrRole from @gigsync/protocol
  first_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Every code an owner has had. Replaced codes are kept (replaced_at set) so a scan of an old QR is told it ended,
-- and so an offer can only go through the code that is live now.
CREATE TABLE IF NOT EXISTS qr_codes (
  code        TEXT PRIMARY KEY,                -- 9 random bytes, base64url: 12 characters
  user_id     TEXT NOT NULL REFERENCES qr_owners (user_id),
  created_at  TIMESTAMPTZ NOT NULL,
  replaced_at TIMESTAMPTZ
);
-- At most one live code per owner; also serves "the owner's live code".
CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_live ON qr_codes (user_id) WHERE replaced_at IS NULL;
-- The foreign key, for "every code of this owner" (offers received by a household across its codes).
CREATE INDEX IF NOT EXISTS qr_codes_user ON qr_codes (user_id);

-- Lookups per signed-in person in the current window, found or not, so codes cannot be guessed. One row per person who
-- looked something up recently; the count starts again once the window has passed.
CREATE TABLE IF NOT EXISTS qr_lookups (
  user_id      TEXT PRIMARY KEY REFERENCES users (user_id),
  lookups      INTEGER NOT NULL CHECK (lookups > 0),
  window_start TIMESTAMPTZ NOT NULL
);

-- Offers to work: which worker offered through which household code, and when they last did. The mailbox lets a
-- work_offer envelope through only shortly after its sender took an offer here through the recipient's live code, and
-- offers are capped per worker and per household per day.
CREATE TABLE IF NOT EXISTS qr_offers (
  worker_id  TEXT NOT NULL REFERENCES users (user_id),
  code       TEXT NOT NULL REFERENCES qr_codes (code),
  offered_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (worker_id, code)
);
-- Counting one worker's offers today.
CREATE INDEX IF NOT EXISTS qr_offers_by ON qr_offers (worker_id, offered_at);
-- Counting one household's offers today, through its codes.
CREATE INDEX IF NOT EXISTS qr_offers_to ON qr_offers (code, offered_at);
