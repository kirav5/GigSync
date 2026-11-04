import type { BoardProfileInput, UserId, WorkHours } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { type Person, signIn } from "./people.js";
import { sql } from "./sql.js";

/** Udupi, so these workers never meet the ones other test files list. */
const HERE = { lat: 13.34, lon: 74.75 };
const north = (km: number) => ({ lat: HERE.lat + km / 111, lon: HERE.lon });
/** A Monday. */
const MONDAY = "2026-11-09";
/** Nine to one, every weekday, which touches the morning and the afternoon. */
const NINE_TO_ONE: WorkHours = { days: [1, 2, 3, 4, 5], windows: ["morning", "afternoon"], from: 9, to: 13 };
const MORNINGS: WorkHours = { days: [1, 2, 3, 4, 5], windows: ["morning"] };

const card = (name: string, km: number, work_hours?: WorkHours): BoardProfileInput => ({
  display_name: name,
  trades: ["maid"],
  area: north(km),
  area_name: "Udupi",
  rate_paise: 40000,
  languages: ["kn"],
  ...(work_hours ? { work_hours } : {}),
});

/** A job signed on GigSync's record for `worker` on `day`, starting at `hour`, for `hours` a day when given. */
async function signedJob(worker: UserId, household: UserId, day: string, hour: number, hours: number | null = null) {
  await sql(
    `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, price_paise, terms_hash, status, agreed_at,
       attested, work_day, work_window, work_hour, hours_per_day)
     VALUES ($1, $2, $3, 'maid', 40000, $4, 'agreed', now(), true, $5, 'morning', $6, $7)`,
    [`eng_${ulid()}`, worker, household, "0".repeat(64), day, hour, hours],
  );
}

/** The names a search on MONDAY finds, for a start hour and the part of the day it falls in. */
const namesAt = async (as: Person, hour: number, window: "morning" | "afternoon" | "evening") =>
  (await as.api.searchWorkers({ trade: "maid", ...HERE, radius_km: 5, day: MONDAY, window, hour })).map(
    (w) => w.display_name,
  );

describe("start hours on the board (ADR 0053 §1)", () => {
  it("matches a card's from–to by the hour, and a card without them by the part of the day", async () => {
    const asha = await signIn("+919833300101");
    await asha.api.publishProfile(card("Asha", 1, NINE_TO_ONE));
    const bina = await signIn("+919833300102");
    await bina.api.publishProfile(card("Bina", 2, MORNINGS));
    const household = await signIn("+919833300103");

    // 10 am: inside Asha's 9–13, and a morning for Bina.
    expect(await namesAt(household, 10, "morning")).toEqual(["Asha", "Bina"]);
    // 1 pm: Asha's day has ended at 13 though her card says afternoons; Bina works mornings only.
    expect(await namesAt(household, 13, "afternoon")).toEqual([]);
    // 8 am: before Asha starts, still a morning for Bina.
    expect(await namesAt(household, 8, "morning")).toEqual(["Bina"]);
    // The card serves its hours on the clock back.
    const found = await household.api.searchWorkers({ trade: "maid", ...HERE, radius_km: 5 });
    expect(found.find((w) => w.display_name === "Asha")?.work_hours).toEqual(NINE_TO_ONE);
  });

  it("hides a worker whose signed job's hours overlap the asked hour, not one later that day", async () => {
    const chitra = await signIn("+919833300104");
    await chitra.api.publishProfile(card("Chitra", 3));
    const devi = await signIn("+919833300105");
    await devi.api.publishProfile(card("Devi", 4));
    const household = await signIn("+919833300106");
    // Chitra at 10 for the default two hours; Devi at 10 for four hours a day.
    await signedJob(chitra.session.user, household.session.user, MONDAY, 10);
    await signedJob(devi.session.user, household.session.user, MONDAY, 10, 4);

    expect(await namesAt(household, 11, "morning")).not.toContain("Chitra");
    expect(await namesAt(household, 13, "afternoon")).toEqual(expect.arrayContaining(["Chitra"]));
    expect(await namesAt(household, 13, "afternoon")).not.toContain("Devi");
    expect(await namesAt(household, 14, "afternoon")).toEqual(expect.arrayContaining(["Chitra", "Devi"]));
    // An 8 am start, taken as two hours long, ends as the jobs at 10 begin.
    expect(await namesAt(household, 8, "morning")).toEqual(expect.arrayContaining(["Chitra"]));
  });

  it("still hides a worker by the part of the day when the search gives no hour", async () => {
    const esha = await signIn("+919833300107");
    await esha.api.publishProfile(card("Esha", 5));
    const household = await signIn("+919833300108");
    await signedJob(esha.session.user, household.session.user, MONDAY, 10);
    const names = async (window: "morning" | "afternoon") =>
      (await household.api.searchWorkers({ trade: "maid", ...HERE, radius_km: 6, day: MONDAY, window })).map(
        (w) => w.display_name,
      );
    expect(await names("morning")).not.toContain("Esha");
    expect(await names("afternoon")).toContain("Esha");
  });

  it("refuses from without to, and the directory refuses it too", async () => {
    const w = await signIn("+919833300109");
    const fromOnly = { days: [1], windows: ["morning"], from: 9 } as WorkHours;
    await expect(w.api.publishProfile(card("X", 1, fromOnly))).rejects.toMatchObject({ status: 400 });
    await w.api.publishProfile(card("X", 1, NINE_TO_ONE));
    const user = w.session.user;
    const update = (set: string) => sql(`UPDATE worker_profiles SET ${set} WHERE user_id = $1`, [user]);
    await expect(update("work_to = NULL")).rejects.toThrow(/worker_profiles_work_from_to_check/);
    await expect(update("work_from = 13")).rejects.toThrow(/worker_profiles_work_from_to_check/);
    await expect(update("work_to = 25")).rejects.toThrow(/check constraint/);
    await expect(update("work_from = NULL, work_to = NULL")).resolves.toEqual([]);
    const job = (hour: number) =>
      sql(
        `INSERT INTO job_records (engagement_id, worker_id, trade, price_paise, terms_hash, status, agreed_at,
           attested, work_hour) VALUES ($1, $2, 'maid', 1, $3, 'agreed', now(), true, $4)`,
        [`eng_${ulid()}`, user, "0".repeat(64), hour],
      );
    await expect(job(24)).rejects.toThrow(/check constraint/);
  });
});
