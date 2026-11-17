import { env } from "cloudflare:test";
import { NO_CITY } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { DEFAULT_CITY } from "../src/db/job-records.js";
import { recordFallbackCity } from "../src/live-cities.js";

/** README "Live cities": a job outside every live city is Bengaluru's as before, unless every place is let in. */
describe("a job record's city outside every live city", () => {
  it("is Bengaluru with LIVE_CITIES unset or a list", () => {
    expect(recordFallbackCity(env)).toBe(DEFAULT_CITY);
    expect(recordFallbackCity({ ...env, LIVE_CITIES: "bengaluru,kanpur" })).toBe(DEFAULT_CITY);
  });

  it("is none of Bengaluru's with LIVE_CITIES=*", () => {
    expect(recordFallbackCity({ ...env, LIVE_CITIES: "*" })).toBe(NO_CITY);
  });
});
