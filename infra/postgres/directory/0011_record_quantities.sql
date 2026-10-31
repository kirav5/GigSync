-- Job records carry quantities (ADR 0041 §4): the price drivers a record needs so GigSync can learn its own per-unit
-- rates (per sq ft painted, per meal, per hour a day) from agreed prices. Counts and fixed choices only, never words;
-- the floor area as a band, never the figure a household gave. Drivers the scope columns already hold (meals, who buys
-- the paint, how often a maid comes, the problem) are not repeated. All NULL for a record from a phone that sends none,
-- and for every record stored before this migration; such records count with each unknown driver at its default.
--
-- The two sides' quantities are not compared (an older phone sends none): a record keeps the ones either side sent,
-- or none where both sent different ones (workers/api/src/records/quantities.ts).

ALTER TABLE job_records
  ADD COLUMN IF NOT EXISTS qty_area_band TEXT CHECK (qty_area_band IN
    ('1_800', '801_1200', '1201_1800', '1801_2500', '2501_3500', '3501_5000', '5001_plus')), -- an AreaBand
  ADD COLUMN IF NOT EXISTS qty_rooms SMALLINT CHECK (qty_rooms BETWEEN 1 AND 12),          -- painter: bedrooms
  ADD COLUMN IF NOT EXISTS qty_surface TEXT CHECK (qty_surface IN ('inside', 'outside', 'both')),
  ADD COLUMN IF NOT EXISTS qty_floors SMALLINT CHECK (qty_floors BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS qty_house_type TEXT CHECK (qty_house_type IN ('flat', 'independent', 'villa')),
  ADD COLUMN IF NOT EXISTS qty_finish TEXT CHECK (qty_finish IN ('plain', 'texture')),
  ADD COLUMN IF NOT EXISTS qty_people SMALLINT CHECK (qty_people BETWEEN 1 AND 20),        -- cook
  ADD COLUMN IF NOT EXISTS qty_days_week SMALLINT CHECK (qty_days_week BETWEEN 1 AND 7),   -- cook, driver
  ADD COLUMN IF NOT EXISTS qty_tasks TEXT CHECK (qty_tasks IN ('sweep_mop', 'sweep_mop_dishes', 'full')), -- maid
  ADD COLUMN IF NOT EXISTS qty_hours SMALLINT CHECK (qty_hours BETWEEN 1 AND 12),          -- driver
  ADD COLUMN IF NOT EXISTS qty_vehicle TEXT CHECK (qty_vehicle IN ('hatchback', 'sedan', 'suv')), -- driver
  ADD COLUMN IF NOT EXISTS qty_points SMALLINT CHECK (qty_points BETWEEN 1 AND 30);        -- repairs

-- The per-unit read: one trade's jobs over the last twelve months is served by job_records_market (0010).
