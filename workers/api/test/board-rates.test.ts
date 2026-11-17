import { createExecutionContext, env } from "cloudflare:test";
import { HttpMethod } from "@gigsync/core";
import type { BoardProfileInput, ListedRates } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import app from "../src/index.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** Rates workers list near a household, as a range of at least three; Badami, away from other test files' workers. */
const HERE = { lat: 15.92, lon: 75.68 };
const NEAR = `lat=${HERE.lat}&lon=${HERE.lon}&radius_km=5`;

const card = (name: string, rupees: number, text: string, km = 1): BoardProfileInput => ({
  display_name: name,
  trades: [],
  skills: [{ text, lang: "en" }],
  area: { lat: HERE.lat + km / 111, lon: HERE.lon },
  area_name: "Badami",
  rate_paise: rupees * 100,
  languages: ["en"],
});

const rates = async (query: string) => {
  const res = await call(await signIn("+919822300009"), HttpMethod.get, `/board/rates?${query}`);
  return { status: res.status, body: (await res.json()) as ListedRates };
};

describe("rates listed near a household", () => {
  it("gives the middle of what workers list, rounded, from three workers up", async () => {
    await (await signIn("+919822300001")).api.publishProfile(card("Asha", 400, "Clock Repair"));
    await (await signIn("+919822300002")).api.publishProfile(card("Babu", 600, "clock repair"));
    expect((await rates(`skill=clock%20repair&${NEAR}`)).body).toEqual({ workers: 2 });
    await (await signIn("+919822300003")).api.publishProfile(card("Chitra", 800, "Clock repair"));
    expect((await rates(`skill=clock%20repair&${NEAR}`)).body).toEqual({
      workers: 3,
      low_paise: 50000,
      high_paise: 70000,
    });
  });

  it("counts only workers within the radius", async () => {
    for (const [i, km] of [1, 2, 40].entries())
      await (await signIn(`+91982230001${i}`)).api.publishProfile(card(`W${i}`, 500, "Lamp Repair", km));
    expect((await rates(`skill=lamp%20repair&${NEAR}`)).body).toEqual({ workers: 2 });
  });

  it("refuses a query with no skill or a key that is not normalised, and needs a session", async () => {
    expect((await rates(NEAR)).status).toBe(400);
    expect((await rates(`skill=Clock%20Repair&${NEAR}`)).status).toBe(400);
    const res = await app.fetch(
      new Request(`http://x/v1/board/rates?skill=clock%20repair&${NEAR}`),
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(401);
  });
});
