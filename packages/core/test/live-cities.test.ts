import type { ServedCity } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ANYWHERE, isLiveCity, parseLiveCities, served } from "../src/index.js";

/** The `LIVE_CITIES` setting (README "Live cities"): the directory's cities kept, a list of them, or every place. */

const BENGALURU = "bengaluru";
const KANPUR = "kanpur";
const sitapur = { lat: 27.5706, lon: 80.6826 };
const koramangala = { lat: 12.93, lon: 77.62 };
const bengaluru: ServedCity = {
  key: BENGALURU,
  names: { en: "Bengaluru", hi: "बेंगलुरु", kn: "ಬೆಂಗಳೂರು" },
  state: "karnataka",
  centre: { lat: 12.9767, lon: 77.5713 },
  radius_km: 30,
  areas: [],
};

describe("live cities", () => {
  it("leave the directory's list as it is when unset or blank, and serve only Bengaluru's circle by default", () => {
    for (const unset of [undefined, "", " , "]) {
      const live = parseLiveCities(unset);
      expect(live).toEqual({ anywhere: false, only: undefined });
      expect(isLiveCity(live, BENGALURU)).toBe(true);
      expect(isLiveCity(live, KANPUR)).toBe(true);
    }
    expect(served(koramangala)).toBe(true);
    expect(served(sitapur)).toBe(false);
    expect(served(sitapur, [bengaluru])).toBe(false);
  });

  it("keep only the cities listed, in any case and spacing", () => {
    const live = parseLiveCities(" Bengaluru ");
    expect(isLiveCity(live, BENGALURU)).toBe(true);
    expect(isLiveCity(live, KANPUR)).toBe(false);
    const both = parseLiveCities("bengaluru, kanpur");
    expect(isLiveCity(both, BENGALURU)).toBe(true);
    expect(isLiveCity(both, KANPUR)).toBe(true);
    expect(isLiveCity(both, "mysuru")).toBe(false);
  });

  it("let every place in with *, alone or in a list", () => {
    expect(parseLiveCities(ANYWHERE)).toEqual({ anywhere: true });
    expect(parseLiveCities(`bengaluru,${ANYWHERE}`)).toEqual({ anywhere: true });
    expect(isLiveCity(parseLiveCities(ANYWHERE), KANPUR)).toBe(true);
    expect(served(sitapur, [bengaluru], true)).toBe(true);
    expect(served(koramangala, [bengaluru], true)).toBe(true);
  });
});
