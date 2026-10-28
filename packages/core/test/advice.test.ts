import { Lang, type RateBand } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { median, proposeMandate, ReasonKind, reasonText, validMandate } from "../src/index.js";
import { countIn, present } from "../src/job/details.js";
import { BENGALURU_RATES } from "./phones.js";

const band = BENGALURU_RATES.bands[0] as RateBand;
const plan = (details: Record<string, string> = {}, history: number[] = [], floor = 800000) =>
  proposeMandate({ band, details, history, floor_paise: floor });

describe("reading details", () => {
  it("finds the first whole number in ASCII, Devanagari or Kannada digits", () => {
    expect(countIn("4")).toBe(4);
    expect(countIn("३ लोग")).toBe(3);
    expect(countIn("೧೨ ಜನ")).toBe(12);
    expect(countIn("some")).toBeUndefined();
  });
  it("treats anything but missing, empty, no or zero as present", () => {
    expect([present(undefined), present(""), present("no"), present("0")]).toEqual([false, false, false, false]);
    expect([present("yes"), present("ನಾಯಿ ಇದೆ"), present("2")]).toEqual([true, true, true]);
  });
});

describe("the price plan", () => {
  it("band only: opens at the band's high, will not go below the floor", () => {
    const a = plan();
    expect(a.mandate).toEqual({ opening_paise: 950000, limit_paise: 800000 });
    expect(a.reasons.map((r) => r.kind)).toEqual([ReasonKind.band, ReasonKind.floor, ReasonKind.plan]);
  });

  it("pets add 15% to the whole band, so the limit rises above the floor, rounded up to ₹10", () => {
    const a = plan({ pets: "yes" });
    expect(a.mandate).toEqual({ opening_paise: 1093000, limit_paise: 863000 });
    expect(a.reasons).toContainEqual({ kind: ReasonKind.scope, key: "pets", percent: 15 });
    expect(a.reasons.map((r) => r.kind)).not.toContain(ReasonKind.floor);
  });

  it("people past the three the band covers add 10% each, in any script", () => {
    expect(plan({ people: "5" }).mandate.opening_paise).toBe(1140000);
    expect(plan({ people: "४" }).mandate.opening_paise).toBe(1045000);
    expect(plan({ people: "೩" }).reasons.map((r) => r.kind)).not.toContain(ReasonKind.scope);
  });

  it("opens a little above what the worker was usually paid, never above the band", () => {
    const a = plan({}, [800000, 850000, 900000]);
    expect(a.mandate.opening_paise).toBe(935000);
    expect(a.reasons).toContainEqual({ kind: ReasonKind.history, median_paise: 850000, count: 3 });
    expect(plan({}, [900000, 950000]).mandate.opening_paise).toBe(950000);
  });

  it("never opens below the limit, even when past pay was low", () => {
    expect(plan({}, [600000]).mandate).toEqual({ opening_paise: 800000, limit_paise: 800000 });
  });

  it("a floor above the whole band wins", () => {
    expect(plan({}, [], 1000000).mandate).toEqual({ opening_paise: 1000000, limit_paise: 1000000 });
  });

  it("every plan is a valid mandate for the worker's side", () => {
    for (const d of [{}, { pets: "yes" }, { people: "9" }])
      for (const h of [[], [600000], [2000000]])
        for (const f of [100000, 800000, 2000000]) expect(validMandate("provider", plan(d, h, f).mandate)).toBe(true);
  });

  it("median of an even count is the middle two averaged", () => {
    expect(median([1, 3, 5, 7])).toBe(4);
    expect(median([])).toBeUndefined();
  });

  it("reads its reasons in the owner's language, with rupees as price tags show them", () => {
    const [bandReason, scope, last] = [...plan({ pets: "yes" }).reasons];
    expect(reasonText(Lang.enum.en, bandReason as never)).toBe("The going rate for this work here is ₹8,630–₹10,930.");
    expect(reasonText(Lang.enum.hi, scope as never)).toBe("पालतू जानवर: 15% ज़्यादा।");
    expect(reasonText(Lang.enum.kn, last as never)).toBe("₹10,930 ರಿಂದ ಶುರು ಮಾಡುತ್ತೇವೆ, ₹8,630 ಗಿಂತ ಕಡಿಮೆ ಹೋಗುವುದಿಲ್ಲ.");
  });
});
