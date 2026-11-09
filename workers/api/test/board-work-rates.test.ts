import { HttpMethod } from "@gigsync/core";
import type { BoardProfileInput, BoardResult, ListedRates } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** Rates per kind of work (ADR 0062), near Bagalkot, away from other test files' workers. */
const HERE = { lat: 16.18, lon: 75.66 };
const NEAR = `lat=${HERE.lat}&lon=${HERE.lon}&radius_km=5`;

/** An electrician who also repairs fridges, at ₹300 a visit for wiring and their own rate for fridges. */
const card = (name: string, rupees: number, fridge?: number): BoardProfileInput => ({
  display_name: name,
  trades: ["electrician"],
  skills: [{ text: "Fridge repair", lang: "en", category: "fridge_repair" }],
  area: { lat: HERE.lat + 1 / 111, lon: HERE.lon },
  area_name: "Bagalkot",
  rate_paise: rupees * 100,
  ...(fridge ? { work_rates: [{ skill: "fridge repair", rate_paise: fridge * 100 }] } : {}),
  languages: ["en"],
});

describe("a rate for each kind of work", () => {
  it("is kept with the card and served back", async () => {
    const w = await signIn("+919822500001");
    await w.api.publishProfile(card("Ravi", 300, 600));
    const res = await call(w, HttpMethod.get, "/board/profile");
    const mine = (await res.json()) as BoardProfileInput;
    expect(mine.rate_paise).toBe(30000);
    expect(mine.work_rates).toEqual([{ skill: "fridge repair", rate_paise: 60000 }]);
  });

  it("is the rate a search for that work shows and filters by; other work is at the card's rate", async () => {
    await (await signIn("+919822500002")).api.publishProfile(card("Sunil", 350, 900));
    await (await signIn("+919822500003")).api.publishProfile(card("Meena", 400));
    const viewer = await signIn("+919822500009");
    const search = async (query: string) => {
      const res = await call(viewer, HttpMethod.get, `/board/workers?${query}&${NEAR}`);
      return ((await res.json()) as BoardResult).workers.map((x) => [x.display_name, x.rate_paise]);
    };
    expect(await search("category=fridge_repair")).toEqual(
      expect.arrayContaining([
        ["Sunil", 90000],
        ["Meena", 40000],
      ]),
    );
    expect(await search("category=fridge_repair&max_rate_paise=50000")).not.toContainEqual(["Sunil", 90000]);
    expect(await search("trade=electrician")).toEqual(expect.arrayContaining([["Sunil", 35000]]));
  });

  it("is what the listed range reads", async () => {
    const res = await call(
      await signIn("+919822500009"),
      HttpMethod.get,
      `/board/rates?category=fridge_repair&${NEAR}`,
    );
    const listed = (await res.json()) as ListedRates;
    // Ravi ₹600, Sunil ₹900, Meena at her card's ₹400: the middle half from ₹500 to ₹750.
    expect(listed).toEqual({ workers: 3, low_paise: 50000, high_paise: 75000 });
  });

  it("refuses a rate for work the card does not list", async () => {
    const w = await signIn("+919822500004");
    const bad = { ...card("Asha", 300), work_rates: [{ trade: "plumber" as const, rate_paise: 50000 }] };
    const res = await call(w, HttpMethod.put, "/board/profile", bad);
    expect(res.status).toBe(400);
  });
});
