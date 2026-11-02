import { HttpMethod } from "@gigsync/core";
import { type BoardProfile, Estimate, type EstimateRequest } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { legalFloorPaise } from "../src/estimates/floor.js";
import { clearMarket } from "./market-helpers.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** ADR 0046: maid and driver work by the hour, one visit, some days a week or the month. */

const ESTIMATES = "/estimates";
const MAID: EstimateRequest = { city: "bengaluru", trade: "maid", scope: { rooms: "bhk2", frequency: "daily" } };
const DRIVER: EstimateRequest = { city: "bengaluru", trade: "driver", scope: { hours: "7_to_9" } };
const COOK: EstimateRequest = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } };

beforeEach(clearMarket);

describe("estimates by arrangement", () => {
  it("prices a maid by the hour, the visit and the week in those units, and the month as before", async () => {
    const p = await signIn("+919866680001");
    const in_ = async (arrangement: string) =>
      Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, { ...MAID, arrangement })).json());
    const hourly = await in_("hourly");
    expect(hourly).toMatchObject({ unit: "hour", basis: { kind: "rate_card", legal_minimum_paise: 9_000 } });
    expect(hourly.low_paise).toBeGreaterThanOrEqual(9_000);
    expect(hourly.high_paise).toBeLessThan(50_000);
    expect((await in_("visit")).unit).toBe("visit");
    const weekly = await in_("weekly");
    expect(weekly.unit).toBe("week");
    expect(weekly.basis.legal_minimum_paise).toBeUndefined();
    expect((await in_("monthly")).unit).toBe("month");
    const none = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, MAID)).json());
    expect(none.unit).toBe("month");
  });

  it("prices a driver's trip by its hours and a week by days", async () => {
    const p = await signIn("+919866680002");
    const visit = (hours: number) => ({ ...DRIVER, arrangement: "visit", drivers: { hours, vehicle: "hatchback" } });
    const four = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, visit(4))).json());
    const eight = Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, visit(8))).json());
    expect(four.unit).toBe("visit");
    expect(eight.typical_paise).toBeGreaterThan(four.typical_paise);
    const week = { ...DRIVER, arrangement: "weekly", drivers: { hours: 8, days_week: 5 } };
    expect(Estimate.parse(await (await call(p, HttpMethod.post, ESTIMATES, week)).json()).unit).toBe("week");
  });

  it("refuses an arrangement for a trade not priced by one, and an unknown arrangement", async () => {
    const p = await signIn("+919866680003");
    for (const body of [
      { ...COOK, arrangement: "hourly" },
      { ...MAID, arrangement: "yearly" },
    ]) {
      const res = await call(p, HttpMethod.post, ESTIMATES, body);
      expect(res.status).toBe(400);
    }
  });

  it("floors only monthly and hourly work", () => {
    expect(legalFloorPaise({ ...MAID, arrangement: "hourly" })).toBe(9_000);
    expect(legalFloorPaise({ ...MAID, arrangement: "monthly" })).toBe(350_000);
    expect(legalFloorPaise({ ...MAID, arrangement: "visit" })).toBeUndefined();
    expect(legalFloorPaise({ ...DRIVER, arrangement: "hourly" })).toBeUndefined();
  });
});

/** Visakhapatnam, so these cards never meet the ones other files list. */
const HERE = { lat: 17.69, lon: 83.22 };
/** Far enough from HERE that the first test's cards are out of reach. */
const THERE = { lat: 18.3, lon: 83.9 };
const maid = (name: string, arrangements?: BoardProfile["arrangements"], area = HERE): BoardProfile => ({
  display_name: name,
  trades: ["maid"],
  area,
  area_name: "Vizag",
  rate_paise: 600000,
  languages: ["te"],
  about: "",
  ...(arrangements ? { arrangements } : {}),
});

describe("the board by arrangement", () => {
  it("keeps a card's arrangements and finds only workers who take the one asked", async () => {
    const hourly = await signIn("+919866680011");
    await hourly.api.publishProfile(
      maid("Hema", [
        { arrangement: "hourly", rate_paise: 15000 },
        { arrangement: "monthly", rate_paise: 600000 },
      ]),
    );
    const old = await signIn("+919866680012");
    await old.api.publishProfile(maid("Indira"));
    const visit = await signIn("+919866680013");
    await visit.api.publishProfile(maid("Jaya", [{ arrangement: "visit", rate_paise: 45000 }]));
    const household = await signIn("+919866680014");
    const names = async (arrangement?: "hourly" | "visit" | "weekly" | "monthly") =>
      (await household.api.searchWorkers({ trade: "maid", ...HERE, ...(arrangement ? { arrangement } : {}) }))
        .map((w) => w.display_name)
        .sort();

    expect(await names()).toEqual(["Hema", "Indira", "Jaya"]);
    expect(await names("hourly")).toEqual(["Hema"]);
    expect(await names("visit")).toEqual(["Jaya"]);
    // A card from before arrangements takes monthly work.
    expect(await names("monthly")).toEqual(["Hema", "Indira"]);
    expect(await names("weekly")).toEqual([]);
    const [hema] = await household.api.searchWorkers({ trade: "maid", ...HERE, arrangement: "hourly" });
    expect(hema?.arrangements).toEqual([
      { arrangement: "hourly", rate_paise: 15000 },
      { arrangement: "monthly", rate_paise: 600000 },
    ]);
  });

  it("drops arrangements a republished card no longer has, and refuses one listed twice", async () => {
    const w = await signIn("+919866680021");
    await w.api.publishProfile(maid("Kala", [{ arrangement: "hourly", rate_paise: 15000 }], THERE));
    await w.api.publishProfile(maid("Kala", undefined, THERE));
    const household = await signIn("+919866680022");
    const [kala] = await household.api.searchWorkers({ trade: "maid", ...THERE, arrangement: "monthly" });
    expect(kala?.display_name).toBe("Kala");
    expect(kala?.arrangements).toBeUndefined();
    const twice = [
      { arrangement: "hourly", rate_paise: 15000 },
      { arrangement: "hourly", rate_paise: 20000 },
    ];
    const res = await call(w, HttpMethod.put, "/board/profile", { ...maid("Kala"), arrangements: twice });
    expect(res.status).toBe(400);
  });
});
