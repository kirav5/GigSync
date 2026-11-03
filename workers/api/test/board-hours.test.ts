import type { BoardProfileInput, UserId, WorkHours } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import { signIn } from "./people.js";
import { sql } from "./sql.js";

/** Gokarna, so these workers never meet the ones other test files list. */
const HERE = { lat: 14.55, lon: 74.32 };
const north = (km: number) => ({ lat: HERE.lat + km / 111, lon: HERE.lon });
/** A Saturday and the Monday after it. */
const SATURDAY = "2026-11-07";
const MONDAY = "2026-11-09";
const WEEKDAY_MORNINGS: WorkHours = { days: [1, 2, 3, 4, 5], windows: ["morning"] };

const card = (name: string, km: number, work_hours?: WorkHours): BoardProfileInput => ({
  display_name: name,
  trades: ["cook"],
  area: north(km),
  area_name: "Gokarna",
  rate_paise: 50000,
  languages: ["kn"],
  ...(work_hours ? { work_hours } : {}),
});

/** A job signed on GigSync's record for `worker`, on a day and part of the day, still agreed. */
async function signedJob(worker: UserId, household: UserId, day: string, window: string) {
  await sql(
    `INSERT INTO job_records (engagement_id, worker_id, household_id, trade, price_paise, terms_hash, status, agreed_at,
       attested, work_day, work_window)
     VALUES ($1, $2, $3, 'cook', 50000, $4, 'agreed', now(), true, $5, $6)`,
    [`eng_${ulid()}`, worker, household, "0".repeat(64), day, window],
  );
}

describe("working hours on the board (ADR 0050)", () => {
  it("lists only workers who work at the asked time and have no signed job then", async () => {
    const asha = await signIn("+919833300001");
    await asha.api.publishProfile(card("Asha", 1, WEEKDAY_MORNINGS));
    const bina = await signIn("+919833300002");
    await bina.api.publishProfile(card("Bina", 2));
    const chitra = await signIn("+919833300003");
    await chitra.api.publishProfile(card("Chitra", 3));
    const household = await signIn("+919833300004");
    await signedJob(chitra.session.user, household.session.user, SATURDAY, "morning");

    const names = async (day?: string, window?: "morning" | "evening") =>
      (
        await household.api.searchWorkers({
          trade: "cook",
          ...HERE,
          ...(day ? { day } : {}),
          ...(window ? { window } : {}),
        })
      ).map((w) => w.display_name);
    // Saturday morning: Asha works weekdays only, Chitra has a job then.
    expect(await names(SATURDAY, "morning")).toEqual(["Bina"]);
    // Monday morning: all three. Monday evening: not Asha, who works mornings.
    expect(await names(MONDAY, "morning")).toEqual(["Asha", "Bina", "Chitra"]);
    expect(await names(MONDAY, "evening")).toEqual(["Bina", "Chitra"]);
    // Saturday at any time: Chitra's morning job does not hide her for the whole day.
    expect(await names(SATURDAY)).toEqual(["Bina", "Chitra"]);
    // No day and no time: everyone, as before.
    expect(await names()).toEqual(["Asha", "Bina", "Chitra"]);
  });

  it("serves the hours on the card, and drops them when the card is published without", async () => {
    const w = await signIn("+919833300005");
    await w.api.publishProfile(card("Devi", 1, WEEKDAY_MORNINGS));
    const household = await signIn("+919833300006");
    const found = await household.api.searchWorkers({ trade: "cook", ...HERE, radius_km: 2 });
    expect(found.find((x) => x.display_name === "Devi")?.work_hours).toEqual(WEEKDAY_MORNINGS);
    await w.api.publishProfile(card("Devi", 1));
    const again = await household.api.searchWorkers({ trade: "cook", ...HERE, radius_km: 2 });
    expect(again.find((x) => x.display_name === "Devi")?.work_hours).toBeUndefined();
  });

  it("refuses hours with no days, repeated days or a day out of the week", async () => {
    const w = await signIn("+919833300007");
    for (const bad of [
      { days: [], windows: ["morning"] },
      { days: [1, 1], windows: ["morning"] },
      { days: [8], windows: ["morning"] },
    ] as WorkHours[])
      await expect(w.api.publishProfile(card("X", 1, bad))).rejects.toMatchObject({ status: 400 });
  });
});
