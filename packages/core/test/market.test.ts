import { City, type EstimateRequest, Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { lineSentence } from "../src/estimate/market.js";
import {
  amountLine,
  ExplainedBy,
  marketAnswer,
  marketLines,
  marketQuestion,
  marketRequest,
  ReasonKind,
  reasonText,
  t,
  wordMarket,
} from "../src/index.js";
import { COOK_GIGSYNC, COOK_MONTH } from "./estimate-fixtures.js";
import { FakeModel, Hang } from "./model-fakes.js";

/** Market questions in the chat (ADR 0039 §2): heard by word lists, answered from the estimate, worded by code or a checked model. */

const { en, hi, kn } = Lang.enum;
const T = Trade.enum;
const city = City.enum.bengaluru;
const AREAS = [
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
  { key: "hsr_layout", names: ["HSR Layout", "HSR", "एचएसआर लेआउट"] },
];
const options = { areas: AREAS };
const ask = (text: string, lang: Lang = en, own?: Trade) => marketQuestion(text, lang, { ...options, own });

describe("hearing a market question", () => {
  it("hears the trade and the area in English, Hindi and Kannada", () => {
    expect(ask("what do cooks charge in Jayanagar?")).toMatchObject({ trade: T.cook, area: "jayanagar" });
    expect(ask("जयनगर में कुक कितना लेते हैं?", hi)).toMatchObject({ trade: T.cook, area: "jayanagar" });
    expect(ask("ಜಯನಗರದಲ್ಲಿ ಅಡುಗೆ ಕೆಲಸದ ದರ ಎಷ್ಟು?", kn)).toMatchObject({ trade: T.cook, area: "jayanagar" });
    expect(ask("पेंटर का रेट क्या है", hi)).toMatchObject({ trade: T.painter });
  });

  it("hears the job's size from the same words", () => {
    const q = ask("painting a 2BHK price");
    expect(q).toMatchObject({ trade: T.painter });
    expect(q && marketRequest(city, q)).toEqual({
      city,
      trade: T.painter,
      scope: { rooms: "bhk2", labour_only: "yes" },
    });
    const there = ask("what do cooks charge in HSR");
    expect(there && marketRequest(city, there)?.area).toBe("hsr-layout");
  });

  it("takes the worker's own trade when the words name an area but no trade", () => {
    expect(ask("what is the usual rate in Jayanagar?", en, T.maid)).toMatchObject({ trade: T.maid, area: "jayanagar" });
    expect(ask("what is the usual rate?", en, T.maid)).toBeUndefined();
  });

  it("is not a question about what the owner earned, a need with a budget, or words with no price in them", () => {
    expect(ask("how much did I earn as a cook this week?")).toBeUndefined();
    expect(ask("need a cook in Jayanagar, pay ₹12000")).toBeUndefined();
    expect(ask("need a cook in Jayanagar tomorrow")).toBeUndefined();
    expect(ask("what do they charge?")).toBeUndefined();
    expect(ask("")).toBeUndefined();
  });
});

describe("the answer's facts", () => {
  const q = { trade: T.cook, area: "jayanagar", details: {} };
  const request = marketRequest(city, q) as EstimateRequest;

  it("are the estimate's lines: the range, its basis with the area, the legal minimum", () => {
    const lines = marketLines(en, city, q, { request, estimate: COOK_GIGSYNC });
    expect(lines.map((l) => lineSentence(en, l))).toEqual([
      "Cook in Jayanagar (3–4 people, 2 meals a day): usually ₹10,500–₹12,500 a month.",
      "From 34 jobs on GigSync in Jayanagar.",
      "Nothing here is below the legal minimum of ₹6,430.",
    ]);
    const hindi = marketLines(hi, city, q, { request, estimate: COOK_GIGSYNC }).map((l) => lineSentence(hi, l));
    expect(hindi[1]).toBe("जयनगर में GigSync के 34 कामों से।");
  });

  it("say the web's sources when the range is the web's", () => {
    const lines = marketLines(en, city, q, { request, estimate: COOK_MONTH });
    expect(lines.map((l) => l.key)).toEqual(["estimate.range_month", "estimate.basis.other", "estimate.legal_min"]);
  });

  it("say there is no range yet, for that trade and place, when there is no estimate", () => {
    const [line] = marketLines(kn, city, q, undefined);
    expect(line && lineSentence(kn, line)).toBe(
      t(kn, "estimate.market_none", { trade: t(kn, "trade.cook"), place: t(kn, "area.jayanagar") }),
    );
    const [inCity] = marketLines(en, city, { trade: T.cook, details: {} }, undefined);
    expect(inCity?.names?.place).toEqual(["city.bengaluru"]);
  });

  it("a worker's plan reason says GigSync jobs, not sources", () => {
    const band = { kind: ReasonKind.band, low_paise: 1_050_000, high_paise: 1_250_000, jobs: 34 } as const;
    expect(reasonText(en, band)).toBe("The usual rate for this job is ₹10,500–₹12,500, from 34 jobs on GigSync.");
  });
});

describe("wording the answer", () => {
  const q = { trade: T.cook, area: "jayanagar", details: {} };
  const lines = marketLines(en, city, q, {
    request: marketRequest(city, q) as EstimateRequest,
    estimate: COOK_GIGSYNC,
  });
  const template = lines.map((l) => lineSentence(en, l)).join(" ");
  const said = (text: string) => JSON.stringify({ text });

  it("is the template without a model, or when it does not answer in time", async () => {
    expect(await wordMarket(undefined, en, lines)).toEqual({ text: template, by: ExplainedBy.template });
    expect(await wordMarket(new FakeModel(Hang), en, lines, 10)).toEqual({ text: template, by: ExplainedBy.template });
  });

  it("keeps the model's words when every number is one of the facts'", async () => {
    const words = "Cooks in Jayanagar usually get ₹10,500 to ₹12,500 a month, going by 34 jobs on GigSync there.";
    const model = new FakeModel(said(words));
    expect(await wordMarket(model, en, lines)).toEqual({ text: words, by: ExplainedBy.model });
    expect(model.prompts[0]).toContain(template);
  });

  it("drops the model's words for a number that is not in the facts, or the wrong script", async () => {
    const invented = said("Cooks in Jayanagar usually get ₹10,500 to ₹15,000 a month, from 34 jobs on GigSync.");
    expect((await wordMarket(new FakeModel(invented), en, lines)).by).toBe(ExplainedBy.template);
    const hindi = said("जयनगर में कुक आम तौर पर ₹10,500 से ₹12,500 महीना लेते हैं।");
    expect((await wordMarket(new FakeModel(hindi), en, lines)).by).toBe(ExplainedBy.template);
    expect((await wordMarket(new FakeModel(new Error("down")), en, lines)).by).toBe(ExplainedBy.template);
  });
});

describe("an amount the owner asked about", () => {
  const q = { trade: T.cook, area: "jayanagar", details: {} };
  const found = { request: marketRequest(city, q) as EstimateRequest, estimate: COOK_GIGSYNC };
  const verdict = (paise: number, lang: Lang = en) => lineSentence(lang, amountLine(paise, found));

  it("falls below, within or above the range, said in each language", () => {
    expect(verdict(800_000)).toBe("₹8,000 is below that range.");
    expect(verdict(1_100_000)).toBe("₹11,000 is within that range.");
    expect(verdict(1_500_000, hi)).toBe("₹15,000 इस दायरे से ज़्यादा है।");
    expect(verdict(800_000, kn)).toBe("₹8,000 ಈ ವ್ಯಾಪ್ತಿಗಿಂತ ಕಡಿಮೆ.");
  });

  it("is said after the facts as the template says it, even when a model words the facts", async () => {
    const asked = { ...q, amount_paise: 800_000 };
    const plain = await marketAnswer(undefined, en, city, asked, found);
    expect(plain.text.endsWith(" ₹8,000 is below that range.")).toBe(true);
    const facts = marketLines(en, city, q, found)
      .map((l) => lineSentence(en, l))
      .join(" ");
    const model = new FakeModel(JSON.stringify({ text: facts }));
    const worded = await marketAnswer(model, en, city, asked, found);
    expect(worded).toEqual({ text: `${facts} ₹8,000 is below that range.`, by: ExplainedBy.model });
    expect(model.prompts[0]).not.toContain("below that range");
    expect((await marketAnswer(undefined, en, city, asked, undefined)).text).not.toContain("₹8,000");
  });
});
