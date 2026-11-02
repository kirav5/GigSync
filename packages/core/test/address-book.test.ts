import { MAX_ADDRESSES, type SavedAddress } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  addressChoice,
  addressLine,
  areaKeyOf,
  listAddresses,
  localitySlug,
  pilotAreaOf,
  removeAddress,
  requestPoint,
  saveAddress,
  TooManyAddressesError,
} from "../src/index.js";
import { MemoryStorage } from "../src/ports.js";

/** ADR 0045: saved addresses on the phone, and what leaves it. */

const ULID = "01JC0000000000000000000000";
const id = (n: number) => `adr_${ULID.slice(0, -2)}${String(n).padStart(2, "0")}`;
const home = (n = 1, more: Partial<SavedAddress> = {}): SavedAddress => ({
  id: id(n),
  label: "home",
  house: "Flat 4B",
  floor: "2nd floor",
  building: "Prestige Lakeside",
  street: "12th Main",
  landmark: "near the Ganesha temple",
  area: "Banashankari 2nd Stage",
  city: "Bengaluru",
  pin: "560070",
  point: { lat: 12.925311, lon: 77.546722 },
  ...more,
});

describe("the address book", () => {
  it("keeps several addresses, replaces one by id, removes one, and refuses more than the limit", async () => {
    const storage = new MemoryStorage();
    await saveAddress(storage, home(1));
    await saveAddress(storage, home(2, { label: "work" }));
    await saveAddress(storage, home(1, { house: "Flat 5C" }));
    expect((await listAddresses(storage)).map((a) => [a.id, a.house])).toEqual([
      [id(1), "Flat 5C"],
      [id(2), "Flat 4B"],
    ]);
    await removeAddress(storage, id(2));
    expect(await listAddresses(storage)).toHaveLength(1);
    for (let n = 2; n <= MAX_ADDRESSES; n++) await saveAddress(storage, home(n));
    await expect(saveAddress(storage, home(MAX_ADDRESSES + 1))).rejects.toBeInstanceOf(TooManyAddressesError);
  });
});

describe("what the worker gets, and what leaves the phone before that", () => {
  it("writes the whole address as one line, only the parts given", () => {
    expect(addressLine(home())).toBe(
      "Flat 4B, 2nd floor, Prestige Lakeside, 12th Main, near the Ganesha temple, Banashankari 2nd Stage, Bengaluru 560070",
    );
    const { floor: _f, building: _b, landmark: _l, street: _s, ...plain } = home();
    expect(addressLine(plain)).toBe("Flat 4B, Banashankari 2nd Stage, Bengaluru 560070");
  });

  it("sends only a point rounded to about a kilometre", () => {
    expect(requestPoint(home())).toEqual({ lat: 12.93, lon: 77.55 });
  });

  it("places an address in a pilot area by its name or its point, else by its locality's slug", () => {
    expect(pilotAreaOf({ area: "HSR Layout" })?.key).toBe("hsr_layout");
    expect(pilotAreaOf({ area: "4th Block", point: { lat: 12.932, lon: 77.585 } })?.key).toBe("jayanagar");
    expect(pilotAreaOf(home())).toBeUndefined();
    expect(addressChoice(home())).toEqual({
      id: id(1),
      label: "home",
      areaName: "Banashankari 2nd Stage",
      area: "banashankari-2nd-stage",
    });
    expect(localitySlug("ಬನಶಂಕರಿ")).toBeUndefined();
  });

  it("finds the pilot area a coarse point is in, as requests now carry one", () => {
    expect(areaKeyOf({ lat: 12.97, lon: 77.64 })).toBe("indiranagar");
    expect(areaKeyOf({ lat: 12.93, lon: 77.55 })).toBeUndefined();
  });
});
