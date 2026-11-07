import { describe, expect, it } from "vitest";
import { addressAsked, MemoryStorage, selectAddress, selectedAddressId, served } from "../src/index.js";

/** Addresses by chat (ADR 0050 §6): where GigSync serves, the words that ask about an address, the one in use. */

describe("addresses by chat", () => {
  it("serves Bengaluru, and not a place outside it", () => {
    expect(served({ lat: 12.93, lon: 77.62 })).toBe(true); // Koramangala
    expect(served({ lat: 12.87, lon: 77.69 })).toBe(true); // Sarjapur Road
    expect(served({ lat: 12.3, lon: 76.64 })).toBe(false); // Mysuru
    expect(served({ lat: 19.07, lon: 72.88 })).toBe(false); // Mumbai
  });

  it("follows the cities the directory serves, once the phone has them (ADR 0061)", () => {
    const kanpur = {
      key: "kanpur",
      names: { en: "Kanpur", hi: "कानपुर", kn: "ಕಾನ್ಪುರ" },
      state: "uttar_pradesh",
      centre: { lat: 26.4499, lon: 80.3319 },
      radius_km: 25,
      areas: [],
    };
    const kalyanpur = { lat: 26.5113, lon: 80.2329 };
    expect(served(kalyanpur)).toBe(false);
    expect(served(kalyanpur, [kanpur])).toBe(true);
    expect(served({ lat: 12.93, lon: 77.62 }, [kanpur])).toBe(false);
  });

  it("hears a request to add, change or pick an address, in each language", () => {
    for (const said of [
      "change my address",
      "add a new address",
      "update my location",
      "नया पता जोड़ो",
      "pata badlo",
      "ವಿಳಾಸ ಬದಲಿಸಿ",
    ])
      expect(addressAsked(said)).toBe(true);
    for (const said of ["I need a plumber at my address", "पता नहीं", "what is my address"])
      expect(addressAsked(said)).toBe(false);
  });

  it("keeps the address picked to use", async () => {
    const storage = new MemoryStorage();
    expect(await selectedAddressId(storage)).toBeUndefined();
    await selectAddress(storage, "adr_1");
    expect(await selectedAddressId(storage)).toBe("adr_1");
  });
});
