-- Workers each household asked (agreed 2026-11-18): one row per `request` envelope, kept two days, so the mailbox
-- route can refuse a household's requests past MAX_REQUESTS_PER_DAY in 24 hours. Only who sent it and when: the request
-- itself is sealed, and so is which need it belongs to.

CREATE TABLE IF NOT EXISTS request_log (
  message_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_log_user_sent ON request_log (user_id, sent_at);
