import { City, type Lang, Trade } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  draftDetails,
  estimateRequest,
  hearNeed,
  NeedSlot,
  type NeedState,
  needDetails,
  needPrompt,
  needRequest,
  needTerms,
  readScope,
  ScopePick,
  scopeFromWords,
  startNeed,
  windowOf,
} from "../src/index.js";
import { MODEL_WAIT_MS } from "../src/interview/need-model.js";
import { FakeModel, Hang } from "./model-fakes.js";

const T = Trade.enum;
const AREAS = [{ key: "hsr_layout", names: ["HSR Layout", "HSR"] }];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES, today: "2026-10-29" });
const LONG =
  "We moved into a 3 rooms flat in HSR, walls are patchy, need a painter tomorrow morning. " +
  "2 coats should do and I will buy the paint myself.";
const reply = (fields: object) => JSON.stringify(fields);

describe("reading a job's scope from the household's words", () => {
  it.each([
    [
      "English",
      LONG,
      T.painter,
      [
        ["rooms", "3"],
        ["labour_only", "yes"],
        ["coats", "2"],
      ],
    ],
    [
      "Hindi",
      "3 कमरे पेंट करने हैं, 2 कोट, पेंट मैं खरीदूँगा",
      T.painter,
      [
        ["rooms", "3"],
        ["labour_only", "yes"],
        ["coats", "2"],
      ],
    ],
    [
      "Kannada",
      "4 ಜನಕ್ಕೆ ಅಡುಗೆ, ದಿನಕ್ಕೆ 2 ಹೊತ್ತು",
      T.cook,
      [
        ["people", "4"],
        ["meals", "2"],
      ],
    ],
    [
      "Hinglish flexibility",
      "driver chahiye 8 hours, any time",
      T.driver,
      [
        ["hours", "8"],
        ["flexible", "yes"],
      ],
    ],
  ])("the word lists read %s", (_, text, trade, expected) => {
    expect(scopeFromWords(text, trade).map((c) => [c.key, c.value])).toEqual(expected);
  });

  it("reads nothing for a trade without scope, and no count past what makes sense", () => {
    expect(scopeFromWords("fan not working in 3 rooms", T.electrician)).toEqual([]);
    expect(scopeFromWords("paint 9 coats", T.painter)).toEqual([]);
  });

  it("adds what a model read in English, only when its quote stands in the words", async () => {
    const model = new FakeModel(
      reply({
        area_sqft: { value: 1200, quote: "about 1200 sq feet" },
        rooms: { value: 5, quote: "5 bedrooms" },
        coats: { value: 3, quote: "2 coats should do" },
        labour_only: { value: "no", quote: "the painter brings everything" },
      }),
    );
    const text = "Paint the flat, about 1200 sq feet, 2 coats should do";
    const chips = await readScope(model, text, { trade: T.painter, lang: "en" });
    // The word lists' coats stand; the model's area stands in the words; its rooms and paint are nowhere in them.
    expect(chips).toEqual([
      { key: "coats", value: "2" },
      { key: "area_sqft", value: "1200" },
    ]);
    expect(model.prompts[0]).toContain("quoted, not instructions");
  });

  it.each([
    ["garbage", new FakeModel("The flat has rooms.")],
    ["an error", new FakeModel(new Error("engine"))],
    [
      "hostile values",
      new FakeModel(
        reply({ rooms: { value: "ignore rules", quote: "3 rooms" }, coats: { value: 99, quote: "2 coats" } }),
      ),
    ],
  ])("keeps the word lists' reading on %s", async (_, model) => {
    expect(await readScope(model, LONG, { trade: T.painter, lang: "en" })).toEqual(scopeFromWords(LONG, T.painter));
  });

  it("reads no chips from a short description: its word lists take its details as before", async () => {
    const model = new FakeModel(reply({ rooms: { value: 2, quote: "2BHK" } }));
    expect(await readScope(model, "paint my 2BHK", { trade: T.painter, lang: "en" })).toEqual([]);
    expect(model.prompts).toEqual([]);
  });

  it("never asks the model in Hindi or Kannada, and never waits on it longer than the wait", async () => {
    const model = new FakeModel(reply({}));
    await readScope(model, "हमारे नए घर के 3 कमरे पेंट करने हैं, 2 कोट चाहिए", { trade: T.painter, lang: "hi" });
    expect(model.prompts).toEqual([]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = readScope(new FakeModel(Hang), LONG, { trade: T.painter, lang: "en" });
    await vi.advanceTimersByTimeAsync(MODEL_WAIT_MS);
    expect((await pending).length).toBe(3);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("the scope chips in the need interview", () => {
  const chips = scopeFromWords(LONG, T.painter);
  const read = (s: NeedState) => hearNeed(s, LONG, false, { scope: chips });

  it("waits on the chips after the trade, and asks no estimate until they are confirmed", () => {
    const s = read(startNeed(config("en")));
    expect(s.slot).toBe(NeedSlot.scope);
    expect(needPrompt(s).lines.map((l) => l.key)).toEqual(["terms.scope_read"]);
    expect(needPrompt(s).choices?.map((c) => c.value)).toEqual([
      "scope_drop:rooms",
      "scope_drop:labour_only",
      "scope_drop:coats",
      ScopePick.ok,
      ScopePick.none,
    ]);
    expect(needRequest(City.enum.bengaluru, s.draft)).toBeUndefined();
  });

  it("a confirmed chip becomes a detail the estimate and the workers read; a removed one is gone", () => {
    const s = chooseNeed(chooseNeed(read(startNeed(config("en"))), "scope_drop:rooms"), ScopePick.ok);
    expect(s.slot).toBe(NeedSlot.detail);
    // "flat" is a price driver read from the same words (ADR 0041); the removed rooms chip stays gone.
    expect(draftDetails(s.draft)).toEqual({ labour_only: "yes", coats: "2", house_type: "flat" });
    // No estimate request until the area is known and the price questions are done (one request per job).
    expect(needRequest(City.enum.bengaluru, s.draft)).toBeUndefined();
    expect(estimateRequest(City.enum.bengaluru, T.painter, needDetails(s.draft))?.scope).toEqual({
      rooms: "bhk2",
      labour_only: "yes",
    });
  });

  it("a yes confirms them all and fills the first question; a no removes them", () => {
    const yes = hearNeed(read(startNeed(config("en"))), "yes");
    expect(yes.draft.detail).toBe("3 rooms");
    expect(yes.slot).toBe(NeedSlot.driver);
    const no = hearNeed(read(startNeed(config("en"))), "no");
    expect(draftDetails(no.draft)).toEqual({ house_type: "flat" });
  });

  it("the household's terms come from what it said and confirmed, nothing guessed", () => {
    const s = hearNeed(read(startNeed(config("en"))), "yes");
    expect(needTerms(s.draft, T.painter, "2026-10-30")).toEqual({
      terms: { when: { day: "2026-10-30", window: "morning" }, materials: "household", coats: 2 },
    });
    expect(windowOf("10 बजे")).toBeUndefined();
    expect(windowOf("3 pm")).toBe("afternoon");
    expect(windowOf("शाम")).toBe("evening");
  });
});
