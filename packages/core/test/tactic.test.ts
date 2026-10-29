import { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  Collection,
  DEFAULT_TACTIC,
  MemoryStorage,
  settle,
  setUsualTactic,
  Tactic,
  usualTactic,
} from "../src/index.js";
import { chooseTactic, tacticPrompt, withoutAmounts } from "../src/job/tactic.js";
import { FakeModel, Hang } from "./model-fakes.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

/**
 * A model picks the tactic from the owner's own words (ADR 0033 §2): one of three names, never a number. Garbage,
 * silence, slowness, another language or no model leave the owner's usual tactic. Amounts never reach the prompt, and
 * nothing the other side wrote does either.
 */

const en = Lang.enum.en;
const SHORT_WAIT_MS = 20;
const reply = (tactic: string) => JSON.stringify({ tactic });
const URGENT = "Ceiling fan stopped, I need it fixed today, budget ₹700";

describe("choosing a tactic from the owner's words", () => {
  it("takes the model's tactic when it names one, in any case or wrapping", async () => {
    for (const t of Object.values(Tactic)) {
      const model = new FakeModel(`Sure! ${reply(t.toUpperCase())}`);
      expect(await chooseTactic(model, { words: URGENT, usual: Tactic.patient, lang: en })).toBe(t);
    }
  });

  it("keeps the owner's usual tactic for unclear, garbage, hostile, failing or slow models", async () => {
    const usual = Tactic.patient;
    const input = { words: URGENT, usual, lang: en };
    for (const answer of [reply("unclear"), "quick!", reply("give them 9999"), "{not json", null, new Error("down")])
      expect(await chooseTactic(new FakeModel(answer), input)).toBe(usual);
    expect(await chooseTactic(new FakeModel(Hang), input, SHORT_WAIT_MS)).toBe(usual);
  });

  it("does not ask without a model, without words, or in a language the model does not read", async () => {
    const model = new FakeModel(reply(Tactic.quick));
    expect(await chooseTactic(undefined, { words: URGENT, usual: Tactic.steady, lang: en })).toBe(Tactic.steady);
    expect(await chooseTactic(model, { words: "  ", usual: Tactic.steady, lang: en })).toBe(Tactic.steady);
    expect(await chooseTactic(model, { words: "आज ही चाहिए", usual: Tactic.steady, lang: Lang.enum.hi })).toBe(
      Tactic.steady,
    );
    expect(model.prompts).toEqual([]);
  });

  it("never shows the model an amount, in any script", () => {
    expect(withoutAmounts("budget ₹1,500.50 or ७०० max, 3 rooms")).toBe("budget ## or # max, # rooms");
    const prompt = tacticPrompt(URGENT);
    expect(prompt).toContain("I need it fixed today");
    expect(prompt).not.toContain("700");
    expect(prompt).not.toContain("₹");
  });
});

describe("the owner's usual tactic", () => {
  it("is steady until they choose, and a stored value that is not a tactic counts as steady", async () => {
    const storage = new MemoryStorage();
    expect(await usualTactic(storage)).toBe(DEFAULT_TACTIC);
    await setUsualTactic(storage, Tactic.quick);
    expect(await usualTactic(storage)).toBe(Tactic.quick);
    await storage.put(Collection.ownerSettings, "usual_tactic", "reckless");
    expect(await usualTactic(storage)).toBe(DEFAULT_TACTIC);
    await expect(setUsualTactic(storage, "reckless" as Tactic)).rejects.toThrow(TypeError);
  });
});

describe("tactics on two phones", () => {
  it("the household's comes from its own words once per need; the worker's from their Settings", async () => {
    const relay = new MemoryRelay();
    const model = new FakeModel(reply(Tactic.quick));
    const household = await phone(relay, PRIYA, { model, lang: en });
    const ravi = await phone(relay, RAVI, { worker: electrician() });
    const anil = await phone(relay, { name: "Anil", phone: "+919800000505" }, { worker: electrician() });
    await setUsualTactic(ravi.storage, Tactic.patient);

    const need = { ...fanNeed(65000, { problem: "hums but does not spin" }), need: URGENT };
    const jobs = await household.device.request(need, [ravi.user, anil.user]);
    await settle([household.device, ravi.device, anil.device]);

    // One prompt for the need, holding only the owner's words (amounts hidden): no worker's words reached it.
    const asked = model.prompts.filter((p) => p === tacticPrompt(URGENT));
    expect(asked).toHaveLength(1);
    for (const j of jobs) {
      const mine = await household.device.job(j.engagement.id);
      expect(mine.strategy?.tactic).toBe(Tactic.quick);
      expect(mine.mandate?.limit_paise).toBe(65000);
    }
    // Each request drew its own settings.
    const [a, b] = await Promise.all(jobs.map((j) => household.device.job(j.engagement.id)));
    expect(a?.strategy).not.toEqual(b?.strategy);
    const theirs = (await ravi.device.jobs())[0];
    expect(theirs?.strategy?.tactic).toBe(Tactic.patient);
    expect((await anil.device.jobs())[0]?.strategy?.tactic).toBe(DEFAULT_TACTIC);
  });
});
