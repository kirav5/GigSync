import type { BoardProfile, MyQrRequest, Trade } from "@gigsync/protocol";
import { ulid } from "ulid";
import { type Person, signIn } from "./people.js";
import { sql } from "./sql.js";

/** Mysuru, so these workers never meet the ones other test files put on the board. */
const MYSURU = { lat: 12.3, lon: 76.64 };

export const household = (first_name: string): MyQrRequest => ({ role: "household", first_name });
export const worker = (first_name: string): MyQrRequest => ({ role: "worker", first_name });

export const card = (name: string, trades: Trade[] = ["cook"]): BoardProfile => ({
  display_name: name,
  trades,
  area: MYSURU,
  area_name: "Mysuru",
  rate_paise: 900000,
  languages: ["kn"],
  about: "",
});

/** A worker with a card on the board, signed in. */
export async function listedWorker(phone: string, name: string): Promise<Person> {
  const p = await signIn(phone);
  await p.api.publishProfile(card(name));
  return p;
}

/** A household signed in with a live code; returns the person and the code. */
export async function householdWithCode(phone: string, name: string): Promise<{ home: Person; code: string }> {
  const home = await signIn(phone);
  return { home, code: (await home.api.myQr(household(name))).code };
}

/** A job record between a worker and a household, as both phones' submissions would leave it. */
export async function jobRecord(w: Person, home: Person, status: string): Promise<void> {
  await sql(
    `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, price_paise, terms_hash, status, agreed_at,
       attested)
     VALUES ($1, $2, $3, 'cook', 900000, 'hash', $4, now(), true)`,
    [`eng_${ulid()}`, w.session.user, home.session.user, status],
  );
}
