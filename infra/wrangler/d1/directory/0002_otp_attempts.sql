-- Wrong sign-in codes per phone number, so a number cannot be brute-forced. One row per number that has failed
-- recently; deleted on a successful sign-in. Not a foreign key to phone_bindings: attempts come before the binding.

CREATE TABLE IF NOT EXISTS otp_attempts (
  phone_hmac   TEXT PRIMARY KEY,           -- same HMAC as phone_bindings; never the number itself
  failures     INTEGER NOT NULL,
  window_start TEXT NOT NULL               -- ISO; the count starts again once the window has passed
);
