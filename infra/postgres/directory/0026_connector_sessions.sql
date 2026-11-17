-- Connected assistants (ADR 0068): Claude, ChatGPT and other MCP clients reach GigSync through the connector Worker
-- (workers/mcp), signed in by the owner's number like the app, but as no device. They hold no keys, so nothing is ever
-- sealed to them and they can read no mail; their token opens only the connector's routes (/v1/connector/*):
-- searching the board, the owner's own card and the skills list. Kept apart from `sessions`, whose rows need a device.

CREATE TABLE IF NOT EXISTS connector_sessions (
  token      TEXT PRIMARY KEY,             -- con_<ulid>
  user_id    TEXT NOT NULL REFERENCES users (user_id),
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS connector_sessions_user ON connector_sessions (user_id);
