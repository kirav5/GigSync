import { City } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  alsoSaid,
  askingFirst,
  CITY_RATES,
  checkFirstQuestion,
  chooseNeed,
  firstQuestionPrompt,
  hear,
  NeedPick,
  NeedSlot,
  type NeedState,
  needPrompt,
  needRequest,
  othersInGroup,
  start,
  startNeed,
  tappedNeed,
  withFirstQuestion,
  withNobody,
  withSkill,
} from "../src/index.js";

/** ADR 0061: kinds of work found by group, a tap met by the model's question, and no kind priced as a trade. */

const AREAS = [{ key: "hsr_layout", names: ["HSR"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES, today: "2026-11-08", modelQuestions: true } as never;
const fresh = () => chooseNeed(startNeed(config), NeedPick.list);
const values = (s: NeedState) => needPrompt(s).choices?.map((c) => c.value);

describe("picking the work from the list", () => {
  it("opens a group on a tap, with every kind of work in it, and goes back to the groups", () => {
    const care = chooseNeed(fresh(), "group:care");
    expect(values(care)).toEqual([
      "kind:babysitter",
      "kind:elder_care",
      "kind:home_nurse",
      "kind:physiotherapist",
      "kind:pet_care",
      NeedPick.groups,
    ]);
    expect(values(chooseNeed(care, NeedPick.groups))).toContain("group:care");
  });

  it("puts trades in their groups beside the kinds outside them", () => {
    expect(values(chooseNeed(fresh(), "group:house_help"))).toEqual([
      "maid",
      "cook",
      "kind:laundry",
      "kind:deep_cleaning",
      NeedPick.groups,
    ]);
  });
});

describe("a kind of work picked by a tap", () => {
  const tapped = () => chooseNeed(chooseNeed(fresh(), "group:home_repairs"), "plumber");

  it("waits for the model to word the first question, then asks it in its words", () => {
    const s = tapped();
    expect(s.slot).toBe(NeedSlot.detail);
    expect(askingFirst(s)).toBe(true);
    const asked = withFirstQuestion(s, "Which tap or pipe is leaking?");
    expect(askingFirst(asked)).toBe(false);
    expect(needPrompt(asked).lines[0]).toEqual({
      key: "estimate.answer",
      params: { text: "Which tap or pipe is leaking?" },
    });
  });

  it("asks the fixed question when the model has none", () => {
    expect(needPrompt(withFirstQuestion(tapped(), undefined)).lines[0]?.key).toMatch(/^question\./);
  });

  it("keeps the model's question to the owner's language and away from money", () => {
    expect(checkFirstQuestion('{"question":"What is wrong with your TV?"}', "en")).toBe("What is wrong with your TV?");
    expect(checkFirstQuestion('{"question":"What is your budget?"}', "en")).toBeUndefined();
    expect(checkFirstQuestion('{"question":"What is wrong with your TV?"}', "hi")).toBeUndefined();
    expect(firstQuestionPrompt("TV repair", "job", "en")).toContain('"TV repair"');
  });

  it("works for a kind outside the trades too", () => {
    const pet = { key: "cat care", text: "Pet care", lang: "en", category: "pet_care", workers: 1 } as const;
    const s = tappedNeed(withSkill(fresh(), pet, "Pet care"));
    expect(askingFirst(s)).toBe(true);
  });
});

describe("a kind nobody lists yet", () => {
  it("offers the others in its group that have workers, and a tap on one goes on", () => {
    const listed = [{ key: "maid hsr", text: "Maid", lang: "en", workers: 2 }] as never;
    const others = othersInGroup("laundry", listed);
    expect(others).toEqual(["maid", "cook"]);
    const s = withNobody(startNeed(config), "Laundry and ironing", "iron my clothes", { kind: "laundry", others });
    expect(s.slot).toBe(NeedSlot.outside);
    expect(needPrompt(s).lines.map((l) => l.key)).toContain("need.group_others");
    expect(values(s)).toEqual(["maid", "cook", NeedPick.list]);
    expect(chooseNeed(s, "maid").draft.trade).toBe("maid");
  });
});

describe("a kind's price", () => {
  it("is never a trade's: a kind outside the trades sends no estimate request", () => {
    const pet = { key: "cat care", text: "Pet care", lang: "en", category: "pet_care", workers: 1 } as const;
    const s = withSkill(fresh(), pet, "someone for my cat");
    expect(needRequest(City.enum.bengaluru, s.draft)).toBeUndefined();
  });
});

describe("work a worker also does", () => {
  const card = { trades: [], skills: [{ text: "TV mechanic", lang: "en", category: "tv_repair" }] } as never;
  const at = () => start({ own: "en", areas: AREAS, rates: CITY_RATES }, card);

  it("is heard in 'also', 'too' and their Hindi and Kannada words", () => {
    for (const said of ["I also do cat care", "cat care too", "cat care bhi", "बिल्ली की देखभाल भी"])
      expect(alsoSaid(said)).toBe(true);
    expect(alsoSaid("I do cat care")).toBe(false);
  });

  it("adds to the card instead of replacing what is on it", () => {
    const s = hear({ ...at(), slot: "trade" } as never, "I also do cat care");
    expect(s.draft.skills?.map((k) => k.text)).toEqual(["TV mechanic", "cat care"]);
  });
});
