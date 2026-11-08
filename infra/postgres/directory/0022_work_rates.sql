-- Rates per kind of work (ADR 0062): a worker who fixes fridges and wires houses may charge each differently.
--
-- A trade or skill on a card may carry its own usual rate; NULL means the card's rate (worker_profiles.rate_paise),
-- which is every row before this migration. The lowest rate for each stays on the worker's phone. Search and the
-- listed range read COALESCE(own rate, card rate) for the work asked about.

ALTER TABLE worker_trades ADD COLUMN IF NOT EXISTS rate_paise INTEGER CHECK (rate_paise > 0);
ALTER TABLE worker_skills ADD COLUMN IF NOT EXISTS rate_paise INTEGER CHECK (rate_paise > 0);
