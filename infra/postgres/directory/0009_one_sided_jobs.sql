-- One-sided jobs (ADR 0038 §2): when only the worker's side of a job reaches the server (the household declined the
-- records notice, so its phone never sends), the worker's verified submission is stored as a job that counts on her
-- record, marked not attested, but only once the server delivered the household's own signed `agree` on that
-- engagement to her: a worker cannot invent jobs by naming any user. The household's matching submission later makes
-- it attested; a differing one sets it aside (the job is withdrawn). A household's submission alone never makes a job.
--
-- The delivered agrees are kept in ADR 0036's engagement_signatures (signer, counterpart, engagement; ids only), which
-- 0008 had retired: the mailbox route writes it again, for `agree` envelopes only. engagement_reviews stays retired.

-- Every job stored before this migration was attested by both sides. New rows always say which they are.
ALTER TABLE job_records ADD COLUMN IF NOT EXISTS attested BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE job_records ALTER COLUMN attested DROP DEFAULT;

-- A worker's submission stored as a one-sided job has its own state.
ALTER TABLE job_submissions DROP CONSTRAINT IF EXISTS job_submissions_state_check;
ALTER TABLE job_submissions ADD CONSTRAINT job_submissions_state_check
  CHECK (state IN ('pending', 'one_sided', 'stored', 'mismatch')); -- a JobSubmitState

-- Worker submissions already waiting for their household become one-sided jobs now, when the household's agree on that
-- engagement was delivered to the worker, from the structured fields they carry (the canonical JSON the strict schema
-- accepted), as the API would have stored them. The rest keep waiting for that agree.
INSERT INTO job_records (engagement_id, worker_id, household_id, trade, scope_problem, scope_rooms, scope_frequency,
  scope_people, scope_meals, scope_hours_band, scope_labour_only, work_day, work_daily, work_window, materials_by,
  coats, hours_per_day, price_paise, terms_hash, status, agreed_at, attested)
SELECT s.engagement_id, s.user_id, s.counterpart_id, f->'work'->>'trade',
  f->'work'->'scope'->>'problem', f->'work'->'scope'->>'rooms', f->'work'->'scope'->>'frequency',
  f->'work'->'scope'->>'people', f->'work'->'scope'->>'meals', f->'work'->'scope'->>'hours',
  (f->'work'->'scope'->>'labour_only') = 'yes',
  CASE WHEN f->'terms'->'when'->>'day' = 'daily' THEN NULL ELSE (f->'terms'->'when'->>'day')::date END,
  COALESCE(f->'terms'->'when'->>'day' = 'daily', FALSE),
  f->'terms'->'when'->>'window', f->'terms'->>'materials',
  (f->'terms'->>'coats')::smallint, (f->'terms'->>'hours')::smallint,
  (f->>'price_paise')::integer, s.terms_hash, 'agreed', s.submitted_at, FALSE
FROM job_submissions s CROSS JOIN LATERAL (SELECT s.fields::jsonb AS f) j
WHERE s.state = 'pending' AND s.role = 'provider'
  AND EXISTS (SELECT 1 FROM engagement_signatures g
    WHERE g.signer_id = s.counterpart_id AND g.counterpart_id = s.user_id AND g.engagement_id = s.engagement_id)
ON CONFLICT (engagement_id) DO NOTHING;
UPDATE job_submissions s SET state = 'one_sided'
WHERE s.state = 'pending' AND s.role = 'provider'
  AND EXISTS (SELECT 1 FROM job_records r WHERE r.engagement_id = s.engagement_id AND r.worker_id = s.user_id);
