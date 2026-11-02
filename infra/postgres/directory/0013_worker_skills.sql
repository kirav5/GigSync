-- Skills in a worker's own words (ADR 0047): work outside the trades, listed on the public card ("Tailor", "मेहंदी").
--
-- Each row is one skill on one card, with the key the board searches by. The API computes the key with skillKey from
-- @gigsync/protocol (NFKC, lower case, punctuation as spaces) and checks the words with SkillText before storing them,
-- so a phone cannot choose its own key. Rows go with the card (CASCADE). Cards published before this have no rows and
-- are searched by trade exactly as before.

CREATE TABLE IF NOT EXISTS worker_skills (
  user_id   TEXT NOT NULL REFERENCES worker_profiles (user_id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL CHECK (char_length(skill_key) BETWEEN 2 AND 40), -- skillKey(text)
  text      TEXT NOT NULL CHECK (char_length(text) BETWEEN 2 AND 40),      -- a SkillText, as the worker typed it
  lang      TEXT NOT NULL,                                                  -- a Lang: the language `text` is in
  PRIMARY KEY (user_id, skill_key)
);
-- Search starts from the skill, as it does from the trade: "every tailor". The skill list groups by it too.
CREATE INDEX IF NOT EXISTS worker_skills_key ON worker_skills (skill_key, user_id);
