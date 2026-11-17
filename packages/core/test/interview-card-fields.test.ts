import { Arrangement, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type CardDraft,
  CITY_RATES,
  choose,
  editSaid,
  type Field,
  fieldsFor,
  hear,
  type InterviewState,
  prompt,
  Slot,
  start,
} from "../src/index.js";
import { daysSaid, hoursSaid } from "../src/interview/card-words.js";

/** ADR 0053 §7: everything on the card can be changed in the chat, and a first card stays as short as it was. */

const T = Trade.enum;
const A = Arrangement.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
];
const config = (own: Lang = "en") => ({ own, areas: AREAS, rates: CITY_RATES });
const keys = (s: InterviewState) => prompt(s).lines.map((l) => l.key);
const values = (s: InterviewState) => prompt(s).choices?.map((c) => c.value);
const CARPENTER: CardDraft = {
  trades: [T.carpenter],
  area: "koramangala",
  rate_paise: 80000,
  limit_paise: 60000,
  ask_me: [],
  auto: false,
};
const MAID: CardDraft = {
  trades: [T.maid],
  arrangements: [A.hourly, A.monthly],
  other_rates: { [A.hourly]: 20000 },
  area: "koramangala",
  rate_paise: 900000,
  limit_paise: 700000,
  ask_me: [],
  auto: false,
};
const card = (draft: CardDraft = CARPENTER, offBoard = false) => start(config(), draft, offBoard);
const open = (field: Field, draft?: CardDraft) => choose(card(draft), field);

describe("a first card", () => {
  it("asks how far they go right after the area, and none of the other new questions", () => {
    const atArea = ["electrician", "no", "Koramangala"].reduce((s, a) => hear(s, a), start(config()));
    expect(atArea.slot).toBe(Slot.radius);
    const asked = ["10", "800", "600", "none", "skip"].reduce((s, a) => hear(s, a), atArea);
    expect(asked.draft.radius_km).toBe(10);
    const seen = new Set<string>();
    let s = asked;
    while (s.slot !== Slot.confirm) {
      seen.add(s.slot);
      s = hear(s, "no");
    }
    for (const slot of [Slot.hours, Slot.days, Slot.radius, Slot.materials, Slot.max_hours])
      expect(seen.has(slot)).toBe(false);
  });
});

describe("the hours", () => {
  it.each([
    ["9 am to 6 pm", 9, 18],
    ["9 to 6", 9, 18],
    ["nine to six", 9, 18],
    ["सुबह 9 से शाम 6 बजे तक", 9, 18],
    ["ಬೆಳಿಗ್ಗೆ 9 ರಿಂದ ಸಂಜೆ 6", 9, 18],
    ["10 am to 2 pm", 10, 14],
    ["morning 9 to evening 6", 9, 18],
    ["सुबह नौ से शाम छह", 9, 18],
    ["सुबह ९ बजे से दोपहर २ बजे तक", 9, 14],
  ])("reads %s", (said, from, to) => {
    const s = hear(open(Slot.hours), said);
    expect(s.draft.terms).toMatchObject({ from, to });
    expect(s.slot).toBe(Slot.confirm);
    expect(keys(s)).toContain("iv.got_hours");
    expect(keys(s)).toContain("iv.summary_hours");
  });

  it("asks until when after a start alone, said or tapped", () => {
    const said = hear(open(Slot.hours), "9 am");
    expect(said.slot).toBe(Slot.hours_to);
    expect(hear(said, "6").draft.terms).toMatchObject({ from: 9, to: 18 });
    const tapped = choose(open(Slot.hours), "9");
    expect(values(tapped)?.[0]).toBe("10");
    expect(choose(tapped, "18").draft.terms).toMatchObject({ from: 9, to: 18 });
  });

  it("clears them, and the older parts of the day, on any time", () => {
    const set = {
      ...CARPENTER,
      terms: { from: 9, to: 18, windows: ["morning" as const], materials: "worker" as const },
    };
    const s = hear(open(Slot.hours, set), "any time");
    expect(s.draft.terms).toEqual({ materials: "worker" });
  });

  it("asks again when nothing is a time, and never sets an end before the start", () => {
    expect(keys(hear(open(Slot.hours), "whenever you like it is ok")).at(0)).toBe("iv.got_any_hours");
    expect(hear(open(Slot.hours), "hello").slot).toBe(Slot.hours);
    expect(hoursSaid("hello")).toBeUndefined();
    expect(choose(choose(open(Slot.hours), "9"), "8").slot).toBe(Slot.hours_to);
  });
});

describe("the days", () => {
  it.each([
    ["Monday to Saturday", [1, 2, 3, 4, 5, 6]],
    ["monday-friday", [1, 2, 3, 4, 5]],
    ["सोमवार से शनिवार", [1, 2, 3, 4, 5, 6]],
    ["ಸೋಮವಾರದಿಂದ ಶನಿವಾರ", [1, 2, 3, 4, 5, 6]],
    ["except Sunday", [1, 2, 3, 4, 5, 6]],
    ["रविवार छुट्टी", [1, 2, 3, 4, 5, 6]],
    ["Monday, Wednesday and Friday", [1, 3, 5]],
    ["Friday to Monday", [1, 5, 6, 7]],
    ["every day", []],
    ["हर दिन", []],
  ])("reads %s", (said, days) => {
    expect(daysSaid(said)).toEqual(days);
  });

  it("names nothing in other words", () => {
    expect(daysSaid("hello")).toBeUndefined();
  });

  it("toggles chips, and Done keeps them; none ticked is every day", () => {
    const one = choose(open(Slot.days), "1");
    const two = choose(one, "6");
    expect(two.slot).toBe(Slot.days);
    const done = choose(two, "yes");
    expect(done.draft.terms?.days).toEqual([1, 6]);
    expect(done.slot).toBe(Slot.confirm);
    const none = choose(choose(open(Slot.days, done.draft), "1"), "6");
    expect(choose(none, "yes").draft.terms?.days).toBeUndefined();
  });

  it("Every day clears them", () => {
    const set = { ...CARPENTER, terms: { days: [1, 2] } };
    expect(choose(open(Slot.days, set), "any").draft.terms).toEqual({});
  });
});

describe("how far, materials and a day's hours", () => {
  it("keeps how far they go, tapped or said, within the limit", () => {
    expect(choose(open(Slot.radius), "5").draft.radius_km).toBe(5);
    expect(hear(open(Slot.radius), "7 km").draft.radius_km).toBe(7);
    expect(hear(open(Slot.radius), "100").slot).toBe(Slot.radius);
    expect(keys(hear(open(Slot.radius), "7 km"))).toContain("iv.summary_radius");
  });

  it("keeps who buys the materials, and either clears it", () => {
    expect(hear(open(Slot.materials), "I bring them").draft.terms?.materials).toBe("worker");
    expect(choose(open(Slot.materials), "household").draft.terms?.materials).toBe("household");
    const set = { ...CARPENTER, terms: { materials: "worker" as const } };
    expect(hear(open(Slot.materials, set), "either").draft.terms).toEqual({});
  });

  it("keeps a day's hours, and any clears them", () => {
    expect(choose(open(Slot.max_hours, MAID), "8").draft.terms?.max_hours).toBe(8);
    expect(hear(open(Slot.max_hours, MAID), "7").draft.terms?.max_hours).toBe(7);
    expect(hear(open(Slot.max_hours, MAID), "30").slot).toBe(Slot.max_hours);
    const set = { ...MAID, terms: { max_hours: 8 } };
    expect(choose(open(Slot.max_hours, set), "any").draft.terms).toEqual({});
  });
});

describe("which fields a card offers", () => {
  it("offers only what fits its work", () => {
    expect(fieldsFor(card())).toContain(Slot.materials);
    expect(fieldsFor(card())).not.toContain(Slot.max_hours);
    expect(fieldsFor(card())).not.toContain(Slot.arrangements);
    expect(fieldsFor(card(MAID))).toContain(Slot.arrangements);
    expect(fieldsFor(card(MAID))).not.toContain(Slot.materials);
  });

  it("goes to the summary when asked for one the card does not have", () => {
    const s = editSaid(card(MAID), Slot.materials, "change the materials");
    expect(s.slot).toBe(Slot.confirm);
    expect(keys(s)).toContain("iv.confirm");
  });
});

describe("the rates of a card with several", () => {
  it("asks which, and changes only that one", () => {
    const asked = choose(card(MAID), Slot.rate);
    expect(asked.slot).toBe(Slot.which_rate);
    expect(values(asked)).toEqual([A.hourly, A.monthly]);
    const hourly = choose(asked, A.hourly);
    expect(keys(hourly)).toEqual(["iv.ask.rate_hour"]);
    const s = hear(hourly, "250");
    expect(s.draft.other_rates).toEqual({ [A.hourly]: 25000 });
    expect(s.draft.rate_paise).toBe(900000);
    expect(s.slot).toBe(Slot.confirm);
  });

  it("goes to the main rate's own question, with its checks", () => {
    const monthly = choose(choose(card(MAID), Slot.rate), A.monthly);
    expect(monthly.slot).toBe(Slot.rate);
    expect(hear(monthly, "10000").draft.rate_paise).toBe(1000000);
  });

  it("changes the arrangements, and asks a rate for a new one", () => {
    const s = hear(choose(card(MAID), Slot.arrangements), "hourly, weekly and monthly");
    expect(s.draft.arrangements).toEqual([A.hourly, A.weekly, A.monthly]);
    expect(s.slot).toBe(Slot.rate);
  });

  it("a suggested other rate, tapped, is kept", () => {
    const s = hear(choose(card(MAID), Slot.arrangements), "hourly, weekly and monthly");
    const asked = hear(hear(s, "9000"), "7000");
    expect(asked.slot).toBe(Slot.more_rates);
    // No estimate: nothing to tap, and the amount is said.
    expect(choose(asked, "suggested")).toBe(asked);
    expect(hear(asked, "3000").draft.other_rates?.[A.weekly]).toBe(300000);
  });
});

describe("a value said with the change", () => {
  it("answers the question at once", () => {
    expect(editSaid(card(), Slot.rate, "change my rate to 900").draft.rate_paise).toBe(90000);
    expect(editSaid(card(), Slot.area, "change my area to Jayanagar").draft.area).toBe("jayanagar");
    expect(editSaid(card(), Slot.hours, "change my hours to 9 to 6").draft.terms).toMatchObject({ from: 9, to: 18 });
    expect(editSaid(card(), Slot.days, "change my days to Monday to Friday").draft.terms?.days).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(editSaid(card(), Slot.radius, "change how far I go to 5 km").draft.radius_km).toBe(5);
    expect(editSaid(card(), Slot.trade, "change my work to plumber").draft.trades).toEqual([T.plumber]);
    expect(editSaid(card(), Slot.languages, "change my language to Hindi").draft.languages).toContain("hi");
  });

  it("still checks it: an amount out of range is asked about", () => {
    const s = editSaid(card(MAID), Slot.min, "change my lowest to 9000000");
    expect(s.draft.limit_paise).toBe(700000);
    expect(s.slot).toBe(Slot.min);
  });

  it.each([
    [Slot.rate, "change my rate"],
    [Slot.area, "change my area"],
    [Slot.hours, "change my hours"],
    [Slot.days, "change my days"],
    [Slot.radius, "change how far I go"],
    [Slot.materials, "मैं सामान बदलना चाहता हूँ"],
  ])("only opens %s when the words name no value", (field, said) => {
    const s = editSaid(card(), field, said);
    expect(s.slot).toBe(field);
    expect(s.draft).toEqual(CARPENTER);
  });

  it("goes to the rate named, and keeps the amount for a rate not named until it is picked", () => {
    expect(editSaid(card(MAID), Slot.rate, "change my hourly rate to 300").draft.other_rates).toEqual({
      [A.hourly]: 30000,
    });
    const asked = editSaid(card(MAID), Slot.rate, "change my rate to 300");
    expect(asked.slot).toBe(Slot.which_rate);
    expect(choose(asked, A.hourly).draft.other_rates).toEqual({ [A.hourly]: 30000 });
  });
});

describe("the summary", () => {
  it("names a place found with their location, not its key", () => {
    const placed = { ...CARPENTER, area: "bellandur", place: { name: "Bellandur East", lat: 12.93, lon: 77.67 } };
    expect(prompt(card(placed)).lines[0]).toMatchObject({ params: { area: "Bellandur East" } });
  });
});

describe("changing the area", () => {
  it("drops the place found with their location, so the new area is what goes on the board", () => {
    const placed = { ...CARPENTER, area: "bellandur", place: { name: "Bellandur", lat: 12.93, lon: 77.67 } };
    const s = choose(open(Slot.area, placed), "jayanagar");
    expect(s.draft.area).toBe("jayanagar");
    expect(s.draft.place).toBeUndefined();
  });
});
