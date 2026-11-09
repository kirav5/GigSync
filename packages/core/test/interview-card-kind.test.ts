import type { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  choose,
  hear,
  type InterviewState,
  prompt,
  Slot,
  sameWork,
  sameWorkPrompt,
  start,
} from "../src/index.js";
import { Pick } from "../src/interview/card.js";
import { NONE_OF_THEM } from "../src/skills/same-work.js";
import { FakeModel, ScriptedModel } from "./model-fakes.js";

/** ADR 0059: words said in the card interview are filed only on the worker's yes; a hello is not work. */

const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const config = (own: Lang = "en") => ({ own, areas: AREAS, rates: CITY_RATES });
const TV = { category: "tv_repair" } as const;
const said = (kind = TV as object) => hear(start(config()), "I am a TV mechanic", false, kind as never);
/** Past "Do you also do any of these?" (ADR 0061), asked right after the work, with Done. */
const pastAlso = (s: InterviewState) => {
  expect(s.slot).toBe(Slot.also);
  return choose(s, Pick.yes);
};

describe("the work question in the card interview", () => {
  it("takes no hello as work, and asks again", () => {
    for (const hello of ["hey", "hi", "namaste"]) {
      const s = hear(start(config()), hello);
      expect(s.slot).toBe(Slot.trade);
      expect(s.draft.skills).toBeUndefined();
      expect(prompt(s).lines.map((l) => l.key)).toContain("iv.again.trade");
    }
  });

  it("asks whether the worker's own words are the kind of work the model named", () => {
    const s = said();
    expect(s.slot).toBe(Slot.trade);
    expect(s.draft.skills).toEqual([{ text: "TV mechanic", lang: "en" }]);
    expect(prompt(s).lines).toEqual([
      { key: "iv.skill_kept", params: { skill: "TV mechanic" } },
      { key: "skill.is_work", params: { work: "TV repair" } },
    ]);
    expect(prompt(s).choices?.map((c) => c.value)).toEqual(["yes", "no"]);
  });

  it("files them on a yes, said or tapped, and moves on", () => {
    for (const yes of [hear(said(), "yes"), choose(said(), "yes")]) {
      expect(yes.draft.skills).toEqual([{ text: "TV mechanic", lang: "en", category: "tv_repair" }]);
      expect(yes.kind).toBeUndefined();
      expect(pastAlso(yes).slot).toBe(Slot.arrangements);
    }
  });

  it("makes the work a trade on a yes to one", () => {
    const yes = choose(
      hear(start(config()), "cooling machine fixer", false, { trade: "ac_technician" } as never),
      "yes",
    );
    expect(yes.draft.trades).toEqual(["ac_technician"]);
    expect(yes.draft.skills).toEqual([]);
  });

  it("keeps the words as they are on a no, or after two unclear answers", () => {
    const no = choose(said(), "no");
    expect(no.draft.skills).toEqual([{ text: "TV mechanic", lang: "en" }]);
    expect(no.slot).not.toBe(Slot.trade);
    const once = hear(said(), "maybe");
    expect(once.slot).toBe(Slot.trade);
    expect(prompt(once).lines.map((l) => l.key)).toContain("iv.again.yes_no");
    expect(hear(once, "hmm").draft.skills).toEqual([{ text: "TV mechanic", lang: "en" }]);
  });

  it("asks nothing when the words are a kind of work's own name, or with no suggestion", () => {
    expect(pastAlso(hear(start(config()), "Tailor", false, TV as never)).slot).toBe(Slot.arrangements);
    // Words filed under no kind have no group, so nothing else is offered either.
    expect(hear(start(config()), "TV mechanic").slot).toBe(Slot.arrangements);
  });
});

describe("a kind of work nobody filed under yet", () => {
  const TV_MAN = { key: "tv mechanic", text: "TV mechanic", lang: "en", workers: 1 } as const;
  const FILED = { key: "fridge man", text: "Fridge man", lang: "en", category: "fridge_repair", workers: 1 } as const;

  it("finds the worker's own words for it among the unfiled skills, by name, and checks the name on its own", async () => {
    const model = new ScriptedModel(['{"work":"TV mechanic"}', '{"same":true}']);
    expect(await sameWork(model, "tv_repair", [FILED, TV_MAN])).toEqual(TV_MAN);
    expect(model.prompts[0]).toContain('"TV repair"');
    expect(model.prompts[0]).not.toContain("Fridge man");
    expect(model.prompts[1]).toContain('A worker calls their work "TV mechanic".');
  });

  it("drops the name the list call picked when the check says it is other work", async () => {
    const GEYSER = { key: "geyser repair", text: "geyser repair", lang: "en", workers: 1 } as const;
    const model = new ScriptedModel(['{"work":"geyser repair"}', '{"same":false}']);
    expect(await sameWork(model, "gas_stove_repair", [GEYSER])).toBeUndefined();
    expect(
      await sameWork(new ScriptedModel(['{"work":"geyser repair"}']), "gas_stove_repair", [GEYSER]),
    ).toBeUndefined();
  });

  it("finds none for no, a name off the list, or no answer, and asks nothing with no unfiled skills", async () => {
    expect(await sameWork(new FakeModel('{"work":null}'), "tv_repair", [TV_MAN])).toBeUndefined();
    expect(await sameWork(new FakeModel('{"work":"TV wizard"}'), "tv_repair", [TV_MAN])).toBeUndefined();
    expect(await sameWork(new FakeModel(null), "tv_repair", [TV_MAN])).toBeUndefined();
    const idle = new FakeModel('{"work":"TV mechanic"}');
    expect(await sameWork(idle, "tv_repair", [FILED])).toBeUndefined();
    expect(idle.prompts).toEqual([]);
    expect(sameWorkPrompt("TV repair", ["TV mechanic"])).toContain("- TV mechanic");
  });

  it("offers none of them as a line of its own, and takes it as none", async () => {
    const GEYSER = { key: "geyser repair", text: "geyser repair", lang: "en", workers: 1 } as const;
    const model = new FakeModel(`{"work":"${NONE_OF_THEM}"}`);
    expect(await sameWork(model, "water_tank_cleaning", [GEYSER])).toBeUndefined();
    expect(model.prompts[0]).toContain(`- ${NONE_OF_THEM}\n- geyser repair`);
    // What the kind covers goes with its name, so a small model can tell a tank from a geyser.
    expect(model.prompts[0]).toContain(
      '"Water tank cleaning" (cleaning drinking-water tanks and sumps; an aquarium is not one)',
    );
  });
});
