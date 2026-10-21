-- One row per listing (seller key + listing id). Only active, unexpired listings are kept; updates replace.
CREATE TABLE IF NOT EXISTS listings (
  key TEXT PRIMARY KEY,           -- pubkey|d
  id TEXT NOT NULL,               -- event id
  pubkey TEXT NOT NULL,
  d TEXT NOT NULL,
  did TEXT,                       -- AT Protocol repo it came from (Jetstream), if any
  rkey TEXT,
  category TEXT NOT NULL,         -- collab-<category>
  g4 TEXT NOT NULL, g5 TEXT NOT NULL, g6 TEXT NOT NULL,
  price INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  event TEXT NOT NULL             -- the signed event, returned as is
);
CREATE INDEX IF NOT EXISTS listings_area ON listings (category, g4);
CREATE INDEX IF NOT EXISTS listings_g5 ON listings (g5);
CREATE INDEX IF NOT EXISTS listings_expiry ON listings (expires_at);
CREATE INDEX IF NOT EXISTS listings_repo ON listings (did, rkey);

-- The newest version seen of each removed (sold/withdrawn/deleted) listing, so an older copy can't bring it back.
CREATE TABLE IF NOT EXISTS tombstones (
  key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  id TEXT NOT NULL,
  removed_at INTEGER NOT NULL
);

-- Public ("World") notes, from owners' repos. Full-text search over their text (FTS5, kept in step by triggers).
CREATE TABLE IF NOT EXISTS notes (
  uri TEXT PRIMARY KEY,           -- at://did/dev.collab.world.note/rkey
  did TEXT NOT NULL,
  rkey TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_repo ON notes (did, created_at);
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(text, content='notes', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO notes_fts(rowid, text) VALUES (new.rowid, new.text);
END;
