import type { BoardSkill } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { CITY_RATES, NeedSlot, type NeedState, needPrompt, needWithListed, startNeed } from "../src/index.js";
import type { Model } from "../src/ports.js";
import { checkPick, pickPrompt, pickSkill } from "../src/skills/pick.js";
import { FakeModel } from "./model-fakes.js";

/** The model points at a skill workers really list; it cannot make one up. */

const skill = (text: string): BoardSkill => ({ text, key: text.toLowerCase(), lang: "en", workers: 2 });
/** A model that gives these replies in turn. */
const script = (...replies: string[]): Model => ({ generate: async () => replies.shift() ?? null });
const LIST = [skill("Tailor"), skill("TV repair"), skill("Pest control")];

describe("a listed skill by what the words mean", () => {
  it("takes the number the model gave", async () => {
    expect((await pickSkill(script('{"choice": 2}', '{"right": true}'), "my tv not working", LIST))?.text).toBe(
      "TV repair",
    );
  });

  it("is nothing when the model, asked plainly, does not stand by its pick", async () => {
    expect(await pickSkill(script('{"choice": 3}', '{"right": false}'), "teach me to swim", LIST)).toBeUndefined();
    expect(await pickSkill(script('{"choice": 3}', "no"), "teach me to swim", LIST)).toBeUndefined();
  });

  it("is nothing when the model says none, or names something off the list", () => {
    expect(checkPick('{"choice": null}', LIST)).toBeUndefined();
    expect(checkPick('{"choice": 9}', LIST)).toBeUndefined();
    expect(checkPick('{"choice": 0}', LIST)).toBeUndefined();
    expect(checkPick('{"choice": "TV repair"}', LIST)).toBeUndefined();
    expect(checkPick("TV repair", LIST)).toBeUndefined();
  });

  it("does not ask with nothing to choose from, and gives way when the model gives nothing", async () => {
    const model = new FakeModel('{"choice": 1}');
    expect(await pickSkill(model, "my tv not working", [])).toBeUndefined();
    expect(model.prompts).toEqual([]);
    expect(await pickSkill(new FakeModel(null), "my tv not working", LIST)).toBeUndefined();
  });

  it("quotes the words and numbers the list", () => {
    const prompt = pickPrompt("my tv not working", ["Tailor", "TV repair"]);
    expect(prompt).toContain("2. TV repair");
    expect(prompt).toContain('"my tv not working"');
  });
});

describe("what workers nearby list, at the budget question", () => {
  const atBudget = (s: NeedState, draft: object): NeedState => ({
    ...s,
    slot: NeedSlot.budget,
    draft: { ...s.draft, ...draft },
  });
  const start = startNeed({ own: "en", areas: [], rates: CITY_RATES, today: "2026-11-06" });
  const tv = atBudget(start, { skill: LIST[1], area: "hsr_layout" });
  const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);

  it("shows the range in place of 'no going rate', with how many workers it rests on", () => {
    const s = needWithListed(tv, { workers: 4, low_paise: 40000, high_paise: 70000 });
    expect(keys(s)).toContain("need.listed_rates");
    expect(keys(s)).not.toContain("need.skill_no_rate");
    expect(needPrompt(s).lines.find((l) => l.key === "need.listed_rates")).toMatchObject({
      prices: { low: 40000, high: 70000 },
      params: { count: 4 },
    });
  });

  it("says plainly there is no going rate when too few workers list it", () => {
    expect(keys(needWithListed(tv, { workers: 2 }))).toContain("need.skill_no_rate");
    expect(keys(tv)).toContain("need.skill_no_rate");
  });

  it("is only for a skill: a trade keeps its estimate", () => {
    const plumber = atBudget(start, { trade: "plumber", area: "hsr_layout" });
    expect(keys(needWithListed(plumber, { workers: 4, low_paise: 40000, high_paise: 70000 }))).not.toContain(
      "need.listed_rates",
    );
  });
});
