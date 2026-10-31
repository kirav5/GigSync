import type { JobRecordStatus } from "@gigsync/protocol";
import { ulid } from "ulid";
import { sql } from "./sql.js";

/**
 * Job records written straight into the test directory, for the market-price tests (ADR 0039 §1): how two phones'
 * submissions would leave them, without the signatures, which the record tests cover.
 */

/** One stored cooking job (3–4 people, two meals, the default cook bucket) unless the row says otherwise. */
export interface MarketRow {
  price: number;
  area?: string;
  status?: JobRecordStatus;
  agreedAt?: Date;
  attested?: boolean;
  people?: string;
}

const COOK_TRADE = "cook";
const DEFAULT_PEOPLE = "3_4";
const DEFAULT_MEALS = "2";

async function newUser(): Promise<string> {
  const id = `usr_${ulid()}`;
  await sql("INSERT INTO users (user_id, created_at) VALUES ($1, now())", [id]);
  return id;
}

/**
 * Stores the rows as cooking jobs, agreed at `now` unless a row says when: each between a worker and a household of its
 * own, as a market range needs (ADR 0039 §1), or all between one pair with `onePair`.
 */
export async function seedCookJobs(rows: readonly MarketRow[], now: Date, onePair = false): Promise<void> {
  const pair = async () => Promise.all([newUser(), newUser()]);
  const shared = onePair ? await pair() : undefined;
  for (const r of rows) {
    const [worker, household] = shared ?? (await pair());
    await sql(
      `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, scope_people, scope_meals, price_paise,
         terms_hash, status, agreed_at, attested, area_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        `eng_${ulid()}`,
        worker,
        household,
        COOK_TRADE,
        r.people ?? DEFAULT_PEOPLE,
        DEFAULT_MEALS,
        r.price,
        "0".repeat(64),
        r.status ?? "done",
        r.agreedAt ?? now,
        r.attested ?? true,
        r.area ?? null,
      ],
    );
  }
}

/** `count` rows at `price` in `area` (none: no area). */
export const many = (count: number, price: number, more: Omit<MarketRow, "price"> = {}): MarketRow[] =>
  Array.from({ length: count }, () => ({ price, ...more }));

export async function clearMarket(): Promise<void> {
  await sql("DELETE FROM job_payments");
  await sql("DELETE FROM job_records");
}
