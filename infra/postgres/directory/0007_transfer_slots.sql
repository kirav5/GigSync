-- Moving to a new phone (ADR 0037 §3): the old phone uploads its owner's data, encrypted with a key the server never
-- sees, to a slot the new phone downloads once. Ciphertext only, held for at most 15 minutes: deleted by the first
-- download, and expired slots purged whenever a slot is created or downloaded.

CREATE TABLE IF NOT EXISTS transfer_slots (
  slot_id    TEXT PRIMARY KEY,                          -- xfr_<ulid>; the QR carries it with the key
  user_id    TEXT NOT NULL REFERENCES users (user_id),  -- only this user may download it
  device_id  TEXT NOT NULL REFERENCES devices (device_id), -- the uploader, which the new phone revokes afterwards
  ciphertext TEXT NOT NULL CHECK (length(ciphertext) <= 4194304), -- base64; TRANSFER_MAX_CHARS in @gigsync/protocol
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,                      -- created_at + TRANSFER_TTL_MS (15 minutes)
  CHECK (expires_at > created_at)
);
-- One slot per user (a new upload replaces the old); also serves the foreign key.
CREATE UNIQUE INDEX IF NOT EXISTS transfer_slots_user ON transfer_slots (user_id);
-- The foreign key, so revoking or deleting a device does not scan the table.
CREATE INDEX IF NOT EXISTS transfer_slots_device ON transfer_slots (device_id);
-- The purge of expired slots.
CREATE INDEX IF NOT EXISTS transfer_slots_expiry ON transfer_slots (expires_at);

-- Actions a person may take only so often, counted per person per action in the current window; the count starts
-- again once the window has passed. One row per person who acted recently.
CREATE TABLE IF NOT EXISTS rate_windows (
  user_id      TEXT NOT NULL REFERENCES users (user_id),
  action       TEXT NOT NULL CHECK (action IN ('transfer')), -- a RateAction in workers/api
  hits         INTEGER NOT NULL CHECK (hits > 0),
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, action)
);
