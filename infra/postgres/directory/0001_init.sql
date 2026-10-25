-- Directory on Lakebase Postgres (Neon): who exists, which devices they have, and the keys to reach them. No message
-- content, ever. Every row carries its user_id so the database can be split by user later. Replaces the D1
-- directory (ADR 0013); applied by `pnpm --filter @gigsync/worker-api db:migrate`.

CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,            -- usr_<ulid>
  did         TEXT,                        -- AT Protocol DID once the PDS account exists
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'deleted')),
  locale      TEXT,
  created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS phone_bindings (
  phone_hmac   TEXT PRIMARY KEY,           -- HMAC-SHA256(secret, E.164); never the number itself
  user_id      TEXT NOT NULL REFERENCES users (user_id),
  verified_at  TIMESTAMPTZ NOT NULL,
  frozen_until TIMESTAMPTZ                 -- set when a number may have been recycled
);
CREATE INDEX IF NOT EXISTS phone_bindings_user ON phone_bindings (user_id);

CREATE TABLE IF NOT EXISTS devices (
  device_id      TEXT PRIMARY KEY,         -- dev_<ulid>
  user_id        TEXT NOT NULL REFERENCES users (user_id),
  signing_key    TEXT NOT NULL,            -- Ed25519 public key, base64
  encryption_key TEXT NOT NULL,            -- X25519 public key, base64
  protocol       INTEGER NOT NULL,         -- highest envelope version this device understands
  push_token     TEXT,                     -- FCM (Android) or APNs-via-FCM (Apple)
  created_at     TIMESTAMPTZ NOT NULL,
  last_seen      TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS devices_user ON devices (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS key_events (
  user_id    TEXT NOT NULL REFERENCES users (user_id),
  seq        INTEGER NOT NULL,
  event      TEXT NOT NULL,                -- signed JSON: key change, device revoke, number change
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, seq)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,             -- ses_<ulid>; replaced by signed tokens in M0 hardening
  user_id    TEXT NOT NULL REFERENCES users (user_id),
  device_id  TEXT NOT NULL REFERENCES devices (device_id),
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_device ON sessions (device_id);

CREATE TABLE IF NOT EXISTS consents (
  user_id        TEXT NOT NULL REFERENCES users (user_id),
  purpose        TEXT NOT NULL,            -- contacts_match | location | cloud_ai | analytics
  notice_version TEXT NOT NULL,
  granted_at     TIMESTAMPTZ NOT NULL,
  withdrawn_at   TIMESTAMPTZ,
  PRIMARY KEY (user_id, purpose)
);

-- Wrong sign-in codes per phone number, so a number cannot be brute-forced. One row per number that has failed
-- recently; deleted on a successful sign-in. Not a foreign key to phone_bindings: attempts come before the binding.
CREATE TABLE IF NOT EXISTS otp_attempts (
  phone_hmac   TEXT PRIMARY KEY,           -- same HMAC as phone_bindings; never the number itself
  failures     INTEGER NOT NULL,
  window_start TIMESTAMPTZ NOT NULL        -- the count starts again once the window has passed
);
