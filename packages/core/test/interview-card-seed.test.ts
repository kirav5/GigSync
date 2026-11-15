import { MAX_TRADES, type WorkKind } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, choose, hear, CardPick as Pick, prompt, Slot, startWithWork } from "../src/index.js";

const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES } as const;

describe("a first card's interview from the work picked on tiles", () => {
  it("starts with the trades picked, says them, and asks the next detail instead of the work", () => {
    const s = startWithWork(config, ["maid", "cook"]);
    expect(s.draft.trades).toEqual(["maid", "cook"]);
    expect(s.slot).not.toBe(Slot.trade);
    const lines = prompt(s).lines;
    expect(lines.map((l) => l.key)).not.toContain("iv.ask.trade");
    expect(lines).toContainEqual({ key: "iv.picked_work", names: { work: ["trade.maid", "trade.cook"] } });
  });

  it("puts a kind outside the trades on as a skill under its own name", () => {
    const s = startWithWork(config, ["babysitter"]);
    expect(s.draft.trades).toEqual([]);
    expect(s.draft.skills).toEqual([{ text: "Babysitter", lang: "en", category: "babysitter" }]);
    expect(prompt(s).lines).toContainEqual({ key: "iv.picked_work", names: { work: ["category.babysitter"] } });
  });

  it("leaves off kinds past the card's limit", () => {
    const kinds: WorkKind[] = ["maid", "cook", "driver", "plumber", "electrician", "painter"];
    const s = startWithWork(config, kinds);
    expect((s.draft.trades ?? []).length).toBe(MAX_TRADES);
  });

  it("is the interview as it always began when nothing was picked", () => {
    const s = startWithWork(config, []);
    expect(s.slot).toBe(Slot.trade);
    expect(prompt(s).lines.map((l) => l.key)).toContain("iv.ask.trade");
  });
});

describe("work added in the worker's own words on the work step", () => {
  const keys = (s: ReturnType<typeof startWithWork>) => prompt(s).lines.map((l) => l.key);

  it("asks which kind the words are closest to, with the guesses and Something else, never the work again", () => {
    const s = startWithWork(config, [], ["i sharpen wood"]);
    expect(s.slot).toBe(Slot.trade);
    const asked = prompt(s);
    expect(asked.lines).toContainEqual({
      key: "iv.custom_one",
      params: { words: "i sharpen wood" },
      names: { work: ["trade.carpenter"] },
    });
    expect(asked.choices?.map((c) => c.value)).toEqual(["carpenter", Pick.none]);
    expect(keys(s)).not.toContain("iv.ask.trade");
  });

  it("files the words under the kind tapped and goes on to the details", () => {
    const s = choose(startWithWork(config, ["maid"], ["i sharpen wood"]), "carpenter");
    expect(s.draft.trades).toEqual(["maid", "carpenter"]);
    expect(s.draft.skills ?? []).toEqual([]);
    expect(s.slot).not.toBe(Slot.trade);
    expect(prompt(s).lines).toContainEqual({ key: "iv.custom_filed", names: { work: ["trade.carpenter"] } });
  });

  it("keeps the words as they are for Something else, or a no", () => {
    const tapped = choose(startWithWork(config, [], ["i sharpen wood"]), Pick.none);
    expect(tapped.draft.skills).toEqual([{ text: "sharpen wood", lang: "en" }]);
    expect(tapped.slot).not.toBe(Slot.trade);
    expect(hear(startWithWork(config, [], ["i sharpen wood"]), "no").draft.skills?.[0]?.text).toBe("sharpen wood");
  });

  it("takes a yes, or a kind named, in words", () => {
    expect(hear(startWithWork(config, [], ["i sharpen wood"]), "yes").draft.trades).toEqual(["carpenter"]);
    const named = hear(startWithWork(config, [], ["chappal silna"]), "cobbler");
    expect(named.draft.skills).toEqual([{ text: "chappal silna", lang: "en", category: "cobbler" }]);
  });

  it("asks about each in turn, and keeps words close to no kind without asking", () => {
    const s = startWithWork(config, [], ["xyz qwerty", "i sharpen wood", "bal kaatna"]);
    expect(prompt(s).lines).toContainEqual({ key: "iv.skill_kept", params: { skill: "xyz qwerty" } });
    const next = choose(s, "carpenter");
    expect(prompt(next).lines.map((l) => l.params?.words)).toContain("bal kaatna");
    const done = choose(next, "kind:barber");
    expect(done.draft.skills?.map((sk) => sk.category)).toEqual([undefined, "barber"]);
    expect(done.slot).not.toBe(Slot.trade);
  });

  it("puts a trade named outright straight on the card", () => {
    const s = startWithWork(config, [], ["plumber"]);
    expect(s.draft.trades).toEqual(["plumber"]);
    expect(s.slot).not.toBe(Slot.trade);
  });
});
