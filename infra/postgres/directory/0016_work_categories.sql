-- The kind of work behind a worker's own words (ADR 0059): "TV repair" and "TV mechanic" both category tv_repair, so a
-- search finds them together. A key from WorkCategory in @gigsync/protocol, checked by the API; NULL for a skill that
-- fits none, which is still found by its own key. No CHECK here: the list grows in code, not by a migration.

ALTER TABLE worker_skills ADD COLUMN IF NOT EXISTS category TEXT;

-- Search starts from the category, as it does from the trade or the skill. Skills with none are never searched this way.
CREATE INDEX IF NOT EXISTS worker_skills_category ON worker_skills (category, user_id) WHERE category IS NOT NULL;
