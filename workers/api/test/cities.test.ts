import { HttpMethod } from "@gigsync/core";
import type { CityUpsert, ServedCities } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ADMIN_HEADER, ADMIN_KEY, call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** ADR 0061: the cities and areas served are data in the directory. */
const MYSURU: CityUpsert = {
  key: "mysuru",
  names: { en: "Mysuru", hi: "मैसूरु", kn: "ಮೈಸೂರು" },
  state: "karnataka",
  centre: { lat: 12.2958, lon: 76.6394 },
  radius_km: 20,
  areas: [
    {
      key: "gokulam",
      names: { en: "Gokulam", hi: "गोकुलम", kn: "ಗೋಕುಲಂ" },
      centre: { lat: 12.33, lon: 76.63 },
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
    expect((await call(p, HttpMethod.put, "/admin/cities", MYSURU, admin)).status).toBe(204);
    let { cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities;
    expect(cities.find((c) => c.key === "mysuru")?.areas.map((a) => a.key)).toEqual(["gokulam"]);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...MYSURU, live: false }, admin)).status).toBe(204);
    ({ cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities);
    expect(cities.map((c) => c.key)).not.toContain("mysuru");
  });

  it("refuse a change without the admin key, or with a bad key or radius", async () => {
    const p = await signIn("+919844900003");
    expect((await call(p, HttpMethod.put, "/admin/cities", MYSURU)).status).toBe(403);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...MYSURU, key: "Kan Pur" }, admin)).status).toBe(400);
    expect((await call(p, HttpMethod.put, "/admin/cities", { ...MYSURU, radius_km: 500 }, admin)).status).toBe(400);
  });
});

describe("Kanpur", () => {
  it("is served from the start, with Kalyanpur", async () => {
    const p = await signIn("+919844900004");
    const { cities } = (await (await call(p, HttpMethod.get, "/cities")).json()) as ServedCities;
    const kanpur = cities.find((c) => c.key === "kanpur");
    expect(kanpur).toMatchObject({ state: "uttar_pradesh", radius_km: 25 });
    expect(kanpur?.areas.map((a) => a.key)).toEqual(["kalyanpur"]);
  });
});
