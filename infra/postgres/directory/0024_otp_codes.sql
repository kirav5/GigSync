-- Sign-in codes the API sends itself, by WhatsApp (ADR 0069). One row per number: a new send replaces the code before,
-- so only the latest signs in. Only a hash of the code is kept, and the row is deleted once it signs in. `sends` and
-- `window_start` cap how many codes one number is sent per hour, because each one is paid for.
CREATE TABLE IF NOT EXISTS otp_codes (
  phone_hmac   TEXT PRIMARY KEY,           -- same HMAC as otp_attempts; never the number itself
  code_hash    TEXT NOT NULL,              -- HMAC of the number's hash and the code; never the code itself
  sent_at      TIMESTAMPTZ NOT NULL,       -- a new code waits a little after this
  expires_at   TIMESTAMPTZ NOT NULL,
  sends        INTEGER NOT NULL,           -- codes sent in the current window
  window_start TIMESTAMPTZ NOT NULL        -- the count starts again once the window has passed
);
