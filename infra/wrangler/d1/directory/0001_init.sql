-- Directory: who exists, which devices they have, and the keys to reach them. No message content, ever.
-- Every row carries its user_id so the database can be split by user later.

CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,            -- usr_<ulid>
  did         TEXT,                        -- AT Protocol DID once the PDS account exists
  status      TEXT NOT NULL DEFAULT 'active', -- active | frozen | deleted
  locale      TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phone_bindings (
  phone_hmac   TEXT PRIMARY KEY,           -- HMAC-SHA256(secret, E.164); never the number itself
  user_id      TEXT NOT NULL REFERENCES users(user_id),
  verified_at  TEXT NOT NULL,
  frozen_until TEXT                        -- set when a number may have been recycled
);

CREATE TABLE IF NOT EXISTS devices (
  device_id      TEXT PRIMARY KEY,         -- dev_<ulid>
  user_id        TEXT NOT NULL REFERENCES users(user_id),
  signing_key    TEXT NOT NULL,            -- Ed25519 public key, base64
  encryption_key TEXT NOT NULL,            -- X25519 public key, base64
  protocol       INTEGER NOT NULL,         -- highest envelope version this device understands
  push_token     TEXT,                     -- FCM (Android) or APNs-via-FCM (Apple)
  created_at     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  revoked_at     TEXT
);
CREATE INDEX IF NOT EXISTS devices_user ON devices (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS key_events (
  user_id   TEXT NOT NULL REFERENCES users(user_id),
  seq       INTEGER NOT NULL,
  event     TEXT NOT NULL,                 -- signed JSON: key change, device revoke, number change
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, seq)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,             -- ses_<ulid>; replaced by signed tokens in M0 hardening
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  device_id  TEXT NOT NULL REFERENCES devices(device_id),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  user_id        TEXT NOT NULL REFERENCES users(user_id),
  purpose        TEXT NOT NULL,            -- contacts_match | location | cloud_ai | analytics
  notice_version TEXT NOT NULL,
  granted_at     TEXT NOT NULL,
  withdrawn_at   TEXT,
  PRIMARY KEY (user_id, purpose)
);
