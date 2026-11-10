import { City, Lang, WorkCategory } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import type { MessageKey } from "../src/i18n/t.js";
import {
  alsoSaid,
  CITY_RATES,
  chooseNeed,
  hear,
  NeedPick,
  NeedSlot,
  type NeedState,
  needPrompt,
  needRequest,
  othersInGroup,
  start,
  startNeed,
  t,
  withNobody,
  withSkill,
} from "../src/index.js";
import { langOf, questionProblem } from "../src/job/guard.js";

/** ADR 0061: kinds of work found by group, each asked its own first question (ADR 0065), none priced as a trade. */

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

describe("the first question for the work", () => {
  const tapped = (kind: string, c = config) =>
    chooseNeed(chooseNeed(chooseNeed(startNeed(c), NeedPick.list), "group:home_repairs"), kind);
  const firstKey = (s: NeedState) => needPrompt(s).lines.at(-1)?.key;
  const pet = { key: "cat care", text: "Pet care", lang: "en", category: "pet_care", workers: 1 } as const;
  const trades = ["electrician", "plumber", "carpenter", "ac_technician"];
  const ALL_ASKS = [...WorkCategory.options, ...trades].map((k) => `kind_ask.${k}`) as MessageKey[];

  it("asks a tapped trade its own question at once, with no model to wait for", () => {
    const s = tapped("plumber");
    expect(s.slot).toBe(NeedSlot.detail);
    expect(firstKey(s)).toBe("kind_ask.plumber");
  });

  it("asks it on a phone with no model as well", () => {
    expect(firstKey(tapped("electrician", { ...config, modelQuestions: false } as never))).toBe("kind_ask.electrician");
  });

  it("keeps a trade's fixed question where it already names the work", () => {
    const maid = chooseNeed(chooseNeed(fresh(), "group:house_help"), "maid");
    expect(firstKey(maid)).toBe("question.rooms");
  });

  it("asks a kind outside the trades its own question, and other work the fixed one", () => {
    expect(firstKey(withSkill(fresh(), pet, "Pet care"))).toBe("kind_ask.pet_care");
    const own = { key: "aquarium cleaning", text: "Aquarium cleaning", lang: "en", workers: 1 } as const;
    expect(firstKey(withSkill(fresh(), own, "Aquarium cleaning"))).toBe("question.job");
  });

  it("is written for every kind in every language, as one question in that language", () => {
    for (const lang of Lang.options)
      for (const key of ALL_ASKS) {
        const text = t(lang, key);
        expect(langOf(text), key).toBe(lang);
        expect(text.endsWith("?") && text.split("?").length === 2, `${lang} ${key}`).toBe(true);
      }
  });

  it("asks nothing about money, contacts, the address or who someone is", () => {
    // The guard's English lists match whole words; its Hindi and Kannada ones match inside words on purpose (a model's
    // question is better dropped), so they flag fair words here ("ತೊಂದರೆ" holds "ದರ", rate). These are reviewed, not
    // generated: only English is checked, and the phone that is the work itself is not a phone number.
    const allowed: Readonly<Record<string, string>> = { "kind_ask.mobile_repair": "contact" };
    for (const key of ALL_ASKS) expect(questionProblem(t("en", key)), key).toBe(allowed[key]);
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
