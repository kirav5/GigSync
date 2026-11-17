import { describe, expect, it } from "vitest";
import { GROUP_KINDS, groupOf, Trade, WorkCategory, WorkGroup } from "../src/index.js";

describe("groups of kinds of work (ADR 0061)", () => {
  it("hold every trade and every kind of work, each in exactly one group", () => {
    const all = WorkGroup.options.flatMap((g) => GROUP_KINDS[g]);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...Trade.options, ...WorkCategory.options].sort());
  });

  it("say where a kind of work is", () => {
    expect(groupOf("maid")).toBe("house_help");
    expect(groupOf("laundry")).toBe("house_help");
    expect(groupOf("pet_care")).toBe("care");
  });
});
