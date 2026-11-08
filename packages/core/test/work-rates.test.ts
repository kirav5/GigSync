import type { BoardProfile, JobRequest, Skill } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  edit,
  hear,
  prompt,
  publicWorkRates,
  rateFor,
  refillFromCard,
  requestWork,
  Slot,
  skillWork,
  start,
  type WorkerRules,
  withFloor,
} from "../src/index.js";

/** Rates per kind of work (ADR 0062): an electrician who also repairs fridges charges each differently. */

const FRIDGE: Skill = { text: "Fridge repair", lang: "en", category: "fridge_repair" };
const FRIDGE_ID = skillWork(FRIDGE);
const RULES: Pick<WorkerRules, "trades" | "skills" | "rate" | "work_rates"> = {
  trades: ["electrician"],
  skills: [FRIDGE],
  rate: { opening_paise: 30000, limit_paise: 24000 },
  work_rates: [{ work: FRIDGE_ID, rate: { opening_paise: 60000, limit_paise: 48000 } }],
};
const ask = (r: Partial<JobRequest>): Pick<JobRequest, "trade" | "details" | "skill"> => ({
  trade: "other",
  details: {},
  ...r,
});

describe("the plan for a request", () => {
  it("is the kind's own when it has one, by the skill's words or its kind", () => {
    expect(rateFor(RULES, ask({ skill: { text: "fridge repair", lang: "en" } }))).toEqual(RULES.work_rates?.[0]?.rate);
    expect(rateFor(RULES, ask({ skill: { text: "फ्रिज ठीक करना", lang: "hi", category: "fridge_repair" } }))).toEqual(
      RULES.work_rates?.[0]?.rate,
    );
  });

  it("is the card's for the first kind and for a kind without a rate of its own", () => {
    expect(rateFor(RULES, ask({ trade: "electrician" }))).toEqual(RULES.rate);
    expect(rateFor({ ...RULES, work_rates: [] }, ask({ skill: FRIDGE }))).toEqual(RULES.rate);
  });

  it("finds no kind for work the card does not list", () => {
    expect(requestWork(RULES, ask({ trade: "plumber" }))).toBeUndefined();
    expect(requestWork(RULES, ask({ skill: { text: "Tailor", lang: "en", category: "tailor" } }))).toBeUndefined();
  });

  it("shows only the usual rate on the board", () => {
    expect(publicWorkRates(RULES.work_rates)).toEqual([{ skill: "fridge repair", rate_paise: 60000 }]);
  });
});

describe("on a new phone", () => {
  const card: BoardProfile = {
    display_name: "Ravi",
    trades: ["electrician"],
    skills: [FRIDGE],
    area: { lat: 12.97, lon: 77.64 },
    area_name: "Indiranagar",
    rate_paise: 30000,
    work_rates: [{ skill: "fridge repair", rate_paise: 60000 }],
    languages: ["en"],
    about: "",
  };

  it("each kind's rate comes back, and its lowest follows the worker's own at the same share", () => {
    const { worker } = refillFromCard(card, { radius_km: 10 });
    expect(worker.work_rates).toEqual([{ work: FRIDGE_ID, rate: { opening_paise: 60000, limit_paise: 60000 } }]);
    expect(withFloor(worker, 24000).work_rates).toEqual([
      { work: FRIDGE_ID, rate: { opening_paise: 60000, limit_paise: 48000 } },
    ]);
  });
});

describe("the card interview", () => {
  const config = { own: "en" as const, areas: [{ key: "koramangala", names: ["Koramangala"] }], rates: CITY_RATES };
  const work = { trades: ["electrician" as const], skills: [FRIDGE], area: "koramangala" };

  it("asks whether the price is the same for all, then each other kind's rate", () => {
    let s = hear(hear(start(config, work), "300"), "250");
    expect(s.slot).toBe(Slot.same_rate);
    expect(prompt(s).lines.at(-1)).toEqual({ key: "iv.ask.same_rate" });
    s = hear(s, "no");
    expect(s.slot).toBe(Slot.work_rate);
    expect(prompt(s).lines.at(-1)).toEqual({ key: "iv.ask.work_rate", params: { work: "Fridge repair" } });
    s = hear(s, "600");
    expect(s.draft.work_rates).toEqual({ [FRIDGE_ID]: 60000 });
    expect(s.slot).toBe(Slot.languages);
  });

  it("a yes keeps one rate, and a card of one kind is never asked", () => {
    const yes = hear(hear(hear(start(config, work), "300"), "250"), "yes");
    expect(yes.draft.same_rate).toBe(true);
    expect(yes.slot).toBe(Slot.languages);
    const one = hear(hear(start(config, { trades: ["electrician"], area: "koramangala" }), "300"), "250");
    expect(one.slot).toBe(Slot.languages);
  });

  it("can be changed from the summary, and the summary says each kind's rate", () => {
    const whole = {
      ...work,
      rate_paise: 30000,
      limit_paise: 25000,
      same_rate: false,
      work_rates: { [FRIDGE_ID]: 60000 },
    };
    const s = start(config, whole);
    expect(s.slot).toBe(Slot.confirm);
    expect(prompt(s).lines).toContainEqual({
      key: "iv.summary_work_rate",
      params: { work: "Fridge repair" },
      prices: { rate: 60000 },
    });
    const changed = hear(hear(edit(s, Slot.same_rate), "no"), "700");
    expect(changed.draft.work_rates).toEqual({ [FRIDGE_ID]: 70000 });
    expect(changed.slot).toBe(Slot.confirm);
  });
});
