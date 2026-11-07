import type { FindCountRow, FindCountsQuery, FindEvent } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** Days are India's, as the pilot's are. */
const TIME_ZONE = "Asia/Kolkata";
const DAY_FORMAT = "YYYY-MM-DD";

/** One more of this event today; nothing else is kept (ADR 0060). */
export async function countFindEvent(db: Db, event: FindEvent): Promise<void> {
  await db.query(
    `INSERT INTO find_counts (day, event, count) VALUES ((now() AT TIME ZONE $1)::date, $2, 1)
     ON CONFLICT (day, event) DO UPDATE SET count = find_counts.count + 1`,
    [TIME_ZONE, event],
  );
}

/** Each event's count per day, newest first, for the last `days` days. */
export async function findCounts(db: Db, q: FindCountsQuery): Promise<FindCountRow[]> {
  const { rows } = await db.query<FindCountRow>(
    `SELECT to_char(day, $1) AS day, event, count::int AS count FROM find_counts
     WHERE day > (now() AT TIME ZONE $2)::date - $3::int
     ORDER BY find_counts.day DESC, event`,
    [DAY_FORMAT, TIME_ZONE, q.days],
  );
  return rows;
}
