import { HttpMethod } from "@gigsync/core";
import type { BoardProfileInput, BoardResult, ListedRates } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { KM_PER_DEGREE, lonBand } from "../src/db/search-band.js";
import { call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";

/**
 * Leh, away from other test files' workers and far enough north that a degree of longitude is plainly shorter than
 * one of latitude (about 92 km against 111). Areas are stored to 0.01°, so every point here is on that grid.
 */
const HERE = { lat: 34.16, lon: 77.58 };
const RADIUS_KM = 5;
/** 0.05° of longitude is 4.6 km here and 0.06° is 5.5 km: either side of the radius' east and west edges. */
const INSIDE_DEGREES = 0.05;
const OUTSIDE_DEGREES = 0.06;
/** Same latitude, some 275 km away: inside the latitude band, nowhere near the circle. */
const FAR_DEGREES = 3;
const NEAR = `lat=${HERE.lat}&lon=${HERE.lon}&radius_km=${RADIUS_KM}`;

const SKILL_TEXT = "Prayer wheel repair";
const SKILL_KEY = "prayer wheel repair";
const CATEGORY = "tv_repair";
const BY_TRADE = "trade=electrician";
const BY_SKILL = `skill=${encodeURIComponent(SKILL_KEY)}`;
const BY_CATEGORY = `category=${CATEGORY}`;

/** A card found by its trade, its skill and its kind of work alike: one worker for all three shapes of the search. */
const card = (name: string, lat: number, lon: number): BoardProfileInput => ({
  display_name: name,
  trades: ["electrician"],
  skills: [{ text: SKILL_TEXT, lang: "en", category: CATEGORY }],
  area: { lat, lon },
  area_name: "Leh",
  rate_paise: 50000,
  languages: ["en"],
});

const east = (name: string, degrees: number) => card(name, HERE.lat, Number((HERE.lon + degrees).toFixed(2)));

async function names(viewer: Person, query: string): Promise<string[]> {
  const res = await call(viewer, HttpMethod.get, `/board/workers?${query}&${NEAR}`);
  expect(res.status).toBe(200);
  const { workers } = (await res.json()) as BoardResult;
  return workers.map((w) => w.display_name).sort();
}

describe("the longitude band of a search", () => {
  it("is wider in degrees than the latitude band, by the latitude's cosine", () => {
    const { west, east: eastEdge } = lonBand(HERE.lat, HERE.lon, RADIUS_KM);
    const flat = RADIUS_KM / KM_PER_DEGREE;
    expect(eastEdge - HERE.lon).toBeCloseTo(flat / Math.cos((HERE.lat * Math.PI) / 180), 4);
    expect(HERE.lon - west).toBeCloseTo(eastEdge - HERE.lon, 10);
    expect(eastEdge - HERE.lon).toBeGreaterThan(flat);
    expect(eastEdge).toBeLessThan(HERE.lon + OUTSIDE_DEGREES);
    expect(eastEdge).toBeGreaterThan(HERE.lon + INSIDE_DEGREES);
  });

  it("is the plain radius in degrees on the equator", () => {
    const { west, east: eastEdge } = lonBand(0, 10, RADIUS_KM);
    expect(eastEdge - 10).toBeCloseTo(RADIUS_KM / KM_PER_DEGREE, 8);
    expect(10 - west).toBeCloseTo(RADIUS_KM / KM_PER_DEGREE, 8);
  });

  it("allows every longitude where it cannot narrow: at a pole, around one, and across the 180° line", () => {
    const everywhere = { west: -180, east: 180 };
    expect(lonBand(90, 0, RADIUS_KM)).toEqual(everywhere);
    expect(lonBand(-90, 0, RADIUS_KM)).toEqual(everywhere);
    expect(lonBand(89.99, 0, RADIUS_KM)).toEqual(everywhere);
    expect(lonBand(HERE.lat, 179.99, RADIUS_KM)).toEqual(everywhere);
    expect(lonBand(HERE.lat, -179.99, RADIUS_KM)).toEqual(everywhere);
    expect(lonBand(HERE.lat, HERE.lon, 20_000)).toEqual(everywhere);
  });
});

describe("a search bounded east and west as well as north and south", () => {
  it("leaves out a worker at the same latitude but far east or west, by trade, skill and kind of work", async () => {
    await (await signIn("+919826600001")).api.publishProfile(card("Centre", HERE.lat, HERE.lon));
    await (await signIn("+919826600002")).api.publishProfile(east("FarEast", FAR_DEGREES));
    await (await signIn("+919826600003")).api.publishProfile(east("FarWest", -FAR_DEGREES));
    const viewer = await signIn("+919826600004");
    for (const query of [BY_TRADE, BY_SKILL, BY_CATEGORY]) expect(await names(viewer, query)).toEqual(["Centre"]);
  });

  it("still finds workers just inside the radius to the east and west, and not those just outside", async () => {
    await (await signIn("+919826600005")).api.publishProfile(east("EastIn", INSIDE_DEGREES));
    await (await signIn("+919826600006")).api.publishProfile(east("WestIn", -INSIDE_DEGREES));
    await (await signIn("+919826600007")).api.publishProfile(east("EastOut", OUTSIDE_DEGREES));
    await (await signIn("+919826600008")).api.publishProfile(east("WestOut", -OUTSIDE_DEGREES));
    const viewer = await signIn("+919826600004");
    for (const query of [BY_TRADE, BY_SKILL, BY_CATEGORY])
      expect(await names(viewer, query)).toEqual(["Centre", "EastIn", "WestIn"]);

    const res = await call(viewer, HttpMethod.get, `/board/workers?${BY_TRADE}&${NEAR}`);
    const { workers } = (await res.json()) as BoardResult;
    expect(workers[0]?.display_name).toBe("Centre");
    expect(workers[1]?.distance_km).toBeCloseTo(4.6, 1);
  });

  it("counts the same workers towards the rates listed nearby", async () => {
    const viewer = await signIn("+919826600004");
    for (const query of [BY_SKILL, BY_CATEGORY]) {
      const res = await call(viewer, HttpMethod.get, `/board/rates?${query}&${NEAR}`);
      expect((await res.json()) as ListedRates).toEqual({ workers: 3, low_paise: 50000, high_paise: 50000 });
    }
  });
});
