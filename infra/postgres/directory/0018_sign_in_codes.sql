-- Sign-in codes (architecture review row 1): one live code per phone number, kept only as a keyed hash, for five
-- minutes, and deleted the moment it is used. Not a foreign key to phone_bindings: a code comes before the binding.

CREATE TABLE IF NOT EXISTS otp_codes (
  phone_hmac TEXT PRIMARY KEY,          -- same HMAC as phone_bindings; never the number itself
  code_hash  TEXT NOT NULL,             -- HMAC of the number's hash and the code; never the code
  sent_at    TIMESTAMPTZ NOT NULL,      -- a new code for the same number waits a minute after this
  expires_at TIMESTAMPTZ NOT NULL
);
