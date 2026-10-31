import type { UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/**
 * Counts one code lookup by `user` in the window that started after `windowFloor`, and returns the count including
 * this one. Once the window has passed the count starts again at one.
 */
export async function countLookup(db: Db, user: UserId, now: Date, windowFloor: Date): Promise<number> {
  const { rows } = await db.query<{ lookups: number }>(
    `INSERT INTO qr_lookups (user_id, lookups, window_start) VALUES ($1, 1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       lookups = CASE WHEN qr_lookups.window_start <= $3 THEN 1 ELSE qr_lookups.lookups + 1 END,
       window_start = CASE WHEN qr_lookups.window_start <= $3 THEN excluded.window_start ELSE qr_lookups.window_start END
     RETURNING lookups`,
    [user, now, windowFloor],
  );
  return rows[0]?.lookups ?? 0;
}

/** What decides whether a worker may offer through a household's code now, all counted since one day ago. */
export interface OfferCounts {
  /** This worker already offered through this code since then. */
  again: boolean;
  /** Offers this worker sent since then, through any code. */
  byWorker: number;
  /** Offers this household received since then, through any of its codes. */
  toHousehold: number;
}

/** The counts for an offer from `worker` through `code`, owned by `household`. */
export async function offerCounts(
  db: Db,
  worker: UserId,
  household: UserId,
  code: string,
  since: Date,
): Promise<OfferCounts> {
  const { rows } = await db.query<OfferCounts>(
    `SELECT
       EXISTS (SELECT 1 FROM qr_offers WHERE worker_id = $1 AND code = $3 AND offered_at > $4) AS again,
       (SELECT count(*) FROM qr_offers WHERE worker_id = $1 AND offered_at > $4)::int AS "byWorker",
       (SELECT count(*) FROM qr_offers o JOIN qr_codes c ON c.code = o.code
         WHERE c.user_id = $2 AND o.offered_at > $4)::int AS "toHousehold"`,
    [worker, household, code, since],
  );
  const [r] = rows;
  if (!r) throw new Error("offer counts returned no row");
  return r;
}

/** Records that `worker` offered through `code` now. */
export async function recordOffer(db: Db, worker: UserId, code: string, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO qr_offers (worker_id, code, offered_at) VALUES ($1, $2, $3)
     ON CONFLICT (worker_id, code) DO UPDATE SET offered_at = excluded.offered_at`,
    [worker, code, at],
  );
}

/** True when `worker` took an offer through `household`'s live code after `since`: their envelope may go through. */
export async function offerTaken(db: Db, worker: UserId, household: UserId, since: Date): Promise<boolean> {
  const { rows } = await db.query<{ taken: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM qr_offers o JOIN qr_codes c ON c.code = o.code
       WHERE o.worker_id = $1 AND c.user_id = $2 AND c.replaced_at IS NULL AND o.offered_at > $3) AS taken`,
    [worker, household, since],
  );
  return rows[0]?.taken ?? false;
}
