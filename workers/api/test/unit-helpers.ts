import { env } from "cloudflare:test";
import type { EstimateRequest, EstimateResponse } from "@gigsync/protocol";
import { ulid } from "ulid";
import { withDirectory } from "../src/db/client.js";
import { serveEstimate } from "../src/estimates/drivers.js";
import { sql } from "./sql.js";

/**
 * Job records with quantities (ADR 0041 §4), written straight into the test directory for the per-unit rate tests.
 */

export interface UnitJob {
  trade: string;
  price: number;
  area?: string;
  agreedAt?: Date;
  scope?: { people?: string; meals?: string; rooms?: string; labour_only?: boolean };
  qty?: { people?: number; days_week?: number; area_band?: string; surface?: string; floors?: number };
}

async function newUser(): Promise<string> {
  const id = `usr_${ulid()}`;
  await sql("INSERT INTO users (user_id, created_at) VALUES ($1, now())", [id]);
  return id;
}

/** Stores the jobs, each between a worker and a household of its own unless `onePair`. */
export async function seedUnitJobs(jobs: readonly UnitJob[], now: Date, onePair = false): Promise<void> {
  const shared = onePair ? await Promise.all([newUser(), newUser()]) : undefined;
  for (const j of jobs) {
    const [worker, household] = shared ?? (await Promise.all([newUser(), newUser()]));
    await sql(
      `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, scope_people, scope_meals, scope_rooms,
         scope_labour_only, price_paise, terms_hash, status, agreed_at, attested, area_key, qty_people, qty_days_week,
         qty_area_band, qty_surface, qty_floors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'done', $11, true, $12, $13, $14, $15, $16, $17)`,
      [
        `eng_${ulid()}`,
        worker,
        household,
        j.trade,
        j.scope?.people ?? null,
        j.scope?.meals ?? null,
        j.scope?.rooms ?? null,
        j.scope?.labour_only ?? null,
        j.price,
        "0".repeat(64),
        j.agreedAt ?? now,
        j.area ?? null,
        j.qty?.people ?? null,
        j.qty?.days_week ?? null,
        j.qty?.area_band ?? null,
        j.qty?.surface ?? null,
        j.qty?.floors ?? null,
      ],
    );
  }
}

/** `count` copies of a job. */
export const times = (count: number, job: UnitJob): UnitJob[] => Array.from({ length: count }, () => ({ ...job }));

export async function clearUnits(): Promise<void> {
  await sql("DELETE FROM job_payments");
  await sql("DELETE FROM job_records");
}

/** The engine's answer for a request at `now`. */
export const serveAt = (req: EstimateRequest, now: Date): Promise<EstimateResponse> =>
  withDirectory(env.DIRECTORY.connectionString, undefined, (db) => serveEstimate(db, req, now));
