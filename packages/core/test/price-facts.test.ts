import { City, type Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  checkJobType,
  hearNeed,
  looksLikeAddress,
  modelJobType,
  NeedSlot,
  type NeedState,
  needPrompt,
  needRequest,
  scrubFacts,
  scrubJobType,
  startNeed,
  withJobType,
} from "../src/index.js";
import { FakeModel } from "./model-fakes.js";
import { questions, ScriptModel, think } from "./price-fakes.js";

/** ADR 0041's extras: facts and job types the phone's model writes, scrubbed and checked before they travel. */

const city = City.enum.bengaluru;
const AREAS = [{ key: "hsr_layout", names: ["HSR"] }];
const config = (own: Lang, modelQuestions = true) => ({
  own,
  areas: AREAS,
  rates: CITY_RATES,
  today: "2026-10-29",
  modelQuestions,
});
const keys = (s: NeedState) => needPrompt(s).lines.map((l) => l.key);

describe("scrubbing what a model wrote", () => {
  it("cuts phone numbers out, in any script", () => {
    expect(scrubFacts([{ label: "Contact", value: "call 98450 12345 after six" }])).toEqual([
      { label: "Contact", value: "call after six" },
    ]);
    expect(scrubFacts([{ label: "फ़ोन", value: "९८४५०१२३४५" }])).toEqual([]);
  });

  it("drops anything that looks like an address", () => {
    for (const text of ["12, 3rd cross road", "PIN 560102", "flat no 4B", "मकान नंबर 12", "45 MG Road"])
      expect(looksLikeAddress(text)).toBe(true);
    expect(looksLikeAddress("2 floors, damp walls")).toBe(false);
    expect(
      scrubFacts([
        { label: "Where", value: "12 5th main, HSR" },
        { label: "Walls", value: "damp" },
      ]),
    ).toEqual([{ label: "Walls", value: "damp" }]);
    expect(scrubJobType("tutor at 560102")).toBeUndefined();
  });

  it("keeps at most five facts", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ label: `Fact ${"abcdefg"[i]}`, value: "yes" }));
    expect(scrubFacts(many)).toHaveLength(5);
  });
});

describe("a need outside the trades", () => {
  it.each([
    ["en", "I need a wedding photographer for Saturday", "wedding photographer"],
    ["hi", "शनिवार को शादी के लिए फ़ोटोग्राफ़र चाहिए", "शादी फ़ोटोग्राफ़र"],
    ["kn", "ಶನಿವಾರ ಮದುವೆಗೆ ಫೋಟೋಗ್ರಾಫರ್ ಬೇಕು", "ಮದುವೆ ಫೋಟೋಗ್ರಾಫರ್"],
  ] as const)(
    "in %s: the model's questions, then plainly no prices and nobody offering it yet",
    async (own, text, label) => {
      expect(await modelJobType(new FakeModel(JSON.stringify({ job_type: label })), text, own)).toBe(label);
      const asked = hearNeed(startNeed(config(own)), text);
      expect(asked.slot).toBe(NeedSlot.trade);
      const s = withJobType(asked, label, text);
      expect(s.slot).toBe(NeedSlot.driver);
      const done = await think(s, new ScriptModel([questions()]));
      expect(done.slot).toBe(NeedSlot.outside);
      expect(needRequest(city, done.draft)).toBeUndefined();
      // No prices for work outside the trades (founders, 2026-10-31): no request, and the plain line.
      expect(keys(done)).toEqual(["driver.no_trade"]);
      expect(needPrompt(done).lines[0]?.params).toEqual({ job: label });
    },
  );

  it("refuses a job type in another script, one that invents a number, or one that is a trade", () => {
    expect(checkJobType(JSON.stringify({ job_type: "photographer" }), "फ़ोटोग्राफ़र चाहिए", "hi")).toBeUndefined();
    expect(
      checkJobType(JSON.stringify({ job_type: "tutor for class 9" }), "home tutor for my son", "en"),
    ).toBeUndefined();
    expect(checkJobType(JSON.stringify({ job_type: "plumber" }), "plumber needed", "en")).toBeUndefined();
    expect(checkJobType(JSON.stringify({ job_type: "tutor for class 8" }), "home tutor for class 8", "en")).toBe(
      "tutor for class 8",
    );
  });

  it("lite mode asks nothing outside the trades", () => {
    const lite = hearNeed(startNeed(config("en", false)), "I need a wedding photographer");
    expect(withJobType(lite, "wedding photographer", "x")).toBe(lite);
  });
});
