import { MAX_ADDRESSES, type SavedAddress } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  addressChoice,
  addressFor,
  addressLine,
  areaKeyOf,
  doorOf,
  listAddresses,
  localitySlug,
  NeedSlot,
  pilotAreaOf,
  removeAddress,
  requestPoint,
  saveAddress,
  TooManyAddressesError,
} from "../src/index.js";
import { firstMissing } from "../src/interview/need.js";
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

  it("gives the worker the door's point only when the owner pinned it (ADR 0050 §7)", () => {
    const pinned = home(1, { pinned: true });
    expect(doorOf(pinned)).toEqual(pinned.point);
    // A point from a search for the area, or from before pins were checked, is the area's, not the door.
    expect(doorOf(home(1, { pinned: false }))).toBeUndefined();
    expect(doorOf(home())).toBeUndefined();
    expect(doorOf(undefined)).toBeUndefined();
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

describe("the address a need without one picked goes to", () => {
  it("is the saved one in the need's locality, else the only one, else the newest; none when nothing is saved", () => {
    const office = home(2, { label: "work", area: "Koramangala" });
    const flat = home(3, { area: "HSR Layout" });
    expect(addressFor([home(1), office, flat], "koramangala")?.id).toBe(office.id);
    expect(addressFor([home(1)], "Whitefield")?.id).toBe(home(1).id);
    expect(addressFor([home(1), office, flat], undefined)?.id).toBe(flat.id);
    expect(addressFor([], "Koramangala")).toBeUndefined();
  });
});

describe("a household's need", () => {
  it("is not whole with an area alone: Find asks which address", () => {
    const draft = { seen: {}, trade: "electrician", detail: "fan", area: "hsr_layout", day: "2026-11-03" } as never;
    expect(firstMissing(draft)).not.toBe(NeedSlot.area);
    expect(firstMissing(draft, true)).toBe(NeedSlot.area);
    expect(firstMissing({ ...(draft as object), address: id(1) } as never, true)).not.toBe(NeedSlot.area);
  });
});
