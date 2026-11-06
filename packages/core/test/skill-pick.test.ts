import type { BoardSkill } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
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
