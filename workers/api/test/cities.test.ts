import { HttpMethod } from "@gigsync/core";
import type { CityUpsert, ServedCities } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ADMIN_HEADER, ADMIN_KEY, call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** ADR 0061: the cities and areas served are data in the directory. */
const KANPUR: CityUpsert = {
  key: "kanpur",
  names: { en: "Kanpur", hi: "कानपुर", kn: "ಕಾನ್ಪುರ" },
  state: "uttar_pradesh",
  centre: { lat: 26.4499, lon: 80.3319 },
  radius_km: 25,
  areas: [
    {
      key: "kalyanpur",
      names: { en: "Kalyanpur", hi: "कल्याणपुर", kn: "ಕಲ್ಯಾಣಪುರ" },
      centre: { lat: 26.5113, lon: 80.2329 },
    },
  ],
  live: true,
};
const admin = { [ADMIN_HEADER]: ADMIN_KEY };

describe("served cities", () => {
  it("start with Bengaluru and its five areas", async () => {
    const p = await signIn("+919844900001");
    const { cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities;
    const bengaluru = cities.find((c) => c.key === "bengaluru");
    expect(bengaluru?.areas.map((a) => a.key).sort()).toEqual([
      "hsr_layout",
      "indiranagar",
      "jayanagar",
      "koramangala",
      "whitefield",
    ]);
  });

  it("take a new city from an admin, and can take it off again without deleting it", async () => {
    const p = await signIn("+919844900002");
    expect((await call(p, HttpMethod.put, "/admin/cities", KANPUR, admin)).status).toBe(204);
    let { cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities;
    expect(cities.find((c) => c.key === "kanpur")?.areas.map((a) => a.key)).toEqual(["kalyanpur"]);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...KANPUR, live: false }, admin)).status).toBe(204);
    ({ cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities);
    expect(cities.map((c) => c.key)).not.toContain("kanpur");
  });

  it("refuse a change without the admin key, or with a bad key or radius", async () => {
    const p = await signIn("+919844900003");
    expect((await call(p, HttpMethod.put, "/admin/cities", KANPUR)).status).toBe(403);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...KANPUR, key: "Kan Pur" }, admin)).status).toBe(400);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...KANPUR, radius_km: 500 }, admin)).status).toBe(400);
  });
});
