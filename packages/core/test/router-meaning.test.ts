import { Lang, Trade } from "@gigsync/protocol";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ChatIntent,
  ChatRole,
  cosine,
  INTENT_SAYINGS,
  type IntentContext,
  intentIndex,
  MeaningIndex,
  meaningRoute,
  NoModel,
  RouteVia,
  routeChat,
  tradeByMeaning,
  tradeIndex,
} from "../src/index.js";
import { BagOfWordsEmbedder, BrokenEmbedder, NoVectors } from "./embedder-fakes.js";
import { FakeModel } from "./model-fakes.js";

/** The embedding router names an intent by its nearest labelled saying (ADR 0042); the lists read the slots. */

const I = ChatIntent;
const worker: IntentContext = {
  lang: Lang.enum.en,
  role: ChatRole.worker,
  contacts: ["Meera"],
  trades: [Trade.enum.cook],
};
const household: IntentContext = { lang: Lang.enum.en, role: ChatRole.household, contacts: [] };
/** A saying from the examples, word for word: the fake places it at similarity 1. */
const EXACT = "I don't want to mentor anymore";

describe("MeaningIndex", () => {
  it("finds the label of the closest saying, among the labels allowed", async () => {
    const index = new MeaningIndex(new BagOfWordsEmbedder(), [
      { said: "paint the walls", label: "painter" },
      { said: "fix the tap", label: "plumber" },
    ]);
    await index.warm();
    expect(await index.nearest("please paint my walls", () => true)).toMatchObject({ label: "painter" });
    expect(await index.nearest("please paint my walls", (l) => l !== "painter")).toMatchObject({ label: "plumber" });
  });

  it("gives nothing without a model or when the model fails, and embeds the sayings once", async () => {
    expect(await new MeaningIndex(new NoVectors(), INTENT_SAYINGS).nearest("hello", () => true)).toBeUndefined();
    expect(await new MeaningIndex(new BrokenEmbedder(), INTENT_SAYINGS).nearest("hello", () => true)).toBeUndefined();
    const embedder = new BagOfWordsEmbedder();
    const index = new MeaningIndex(embedder, INTENT_SAYINGS);
    await index.warm();
    await index.nearest("hello", () => true);
    await index.nearest("thanks", () => true);
    await index.warm();
    expect(embedder.texts.length).toBe(INTENT_SAYINGS.length + 2);
  });

  it("never makes a lookup wait for the sayings: nothing until they are ready, then the label", async () => {
    const index = new MeaningIndex(new BagOfWordsEmbedder(), [{ said: "paint the walls", label: "painter" }]);
    expect(await index.nearest("paint the walls", () => true)).toBeUndefined();
    await index.warm();
    expect(await index.nearest("paint the walls", () => true)).toMatchObject({ label: "painter" });
  });

  it("embeds the sayings in batches when the embedder can", async () => {
    const embedder = new BagOfWordsEmbedder();
    const calls: number[] = [];
    const batching = {
      embed: (t: string) => embedder.embed(t),
      embedMany: async (texts: readonly string[]) => {
        calls.push(texts.length);
        return Promise.all(texts.map((t) => embedder.embed(t)));
      },
    };
    await new MeaningIndex(batching, INTENT_SAYINGS).warm();
    expect(calls.length).toBe(Math.ceil(INTENT_SAYINGS.length / 32));
    expect(calls.reduce((a, b) => a + b, 0)).toBe(INTENT_SAYINGS.length);
  });

  it("cosine of unit vectors", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });
});

describe("meaningRoute", () => {
  const index = intentIndex(new BagOfWordsEmbedder());
  beforeAll(() => index.warm());

  it("names the intent of a saying it knows, and says who named it", async () => {
    expect(await meaningRoute(EXACT, worker, index)).toEqual({ intent: I.helpStop, slots: {}, via: RouteVia.meaning });
  });

  it("reads the trade from the words even when the lists heard another intent", async () => {
    // The lists hear "chat" in this one; the saying is a market example, and the words carry the trade.
    const route = await meaningRoute("HSR alli driver ge tingalige eshtu kodtaare", household, index);
    expect(route).toEqual({
      intent: I.market,
      slots: { trade: Trade.enum.driver, area: "hsr_layout" },
      via: RouteVia.meaning,
    });
  });

  it("keeps the lists' slots whole when they heard the same intent", async () => {
    // Not a saying word for word, so the bag-of-words fake needs a lower floor to place it.
    const route = await meaningRoute("what do cooks charge in Jayanagar?", household, index, { minSimilarity: 0.5 });
    expect(route?.intent).toBe(I.market);
    expect(route?.slots).toEqual({ trade: Trade.enum.cook, area: "jayanagar" });
  });

  it("never names an intent this owner cannot have", async () => {
    // A household has no card; the nearest allowed saying decides instead.
    const route = await meaningRoute("change my rate", household, index);
    expect(route?.intent).not.toBe(I.editCard);
  });

  it("stays silent when the message is far from every saying, or lacks what the intent needs", async () => {
    expect(await meaningRoute("zxqv plorth", worker, index)).toBeUndefined();
    expect(await meaningRoute("", worker, index)).toBeUndefined();
    // A question to a contact the owner does not have: the saying matches, but there is nobody to ask.
    expect(await meaningRoute("is Meera free on Friday?", { ...worker, contacts: [] }, index)).toBeUndefined();
  });

  it("gives nothing without a model, so the readers after it answer", async () => {
    expect(await meaningRoute(EXACT, worker, intentIndex(new NoVectors()))).toBeUndefined();
  });
});

describe("routeChat with a meaning index", () => {
  it("asks the embedding model before the language model, and the lists last", async () => {
    const model = new FakeModel(JSON.stringify({ intent: "chat" }));
    const index = intentIndex(new BagOfWordsEmbedder());
    await index.warm();
    expect((await routeChat(EXACT, worker, model, { meaning: index })).via).toBe(RouteVia.meaning);
    expect(model.prompts).toHaveLength(0);
    const far = await routeChat("zxqv plorth", worker, model, { meaning: index });
    expect(model.prompts).toHaveLength(1);
    expect(far.via).toBe(RouteVia.model);
    expect((await routeChat("zxqv plorth", worker, new NoModel(), { meaning: index })).via).toBe(RouteVia.keywords);
  });

  it("is the old chain without an index", async () => {
    const route = await routeChat("what do cooks charge in Jayanagar?", household, new NoModel());
    expect(route).toMatchObject({ intent: I.market, via: RouteVia.keywords });
    expect(route.slots.trade).toBe(Trade.enum.cook);
  });
});

describe("tradeByMeaning", () => {
  const index = tradeIndex(new BagOfWordsEmbedder());
  beforeAll(() => index.warm());

  it("hears a trade the word lists do not", async () => {
    expect(await tradeByMeaning(index, "get my house cleaned")).toBe(Trade.enum.maid);
  });

  it("names no trade for words unlike any saying, or without a model", async () => {
    expect(await tradeByMeaning(index, "zxqv plorth")).toBeUndefined();
    expect(await tradeByMeaning(tradeIndex(new NoVectors()), "get my house cleaned")).toBeUndefined();
  });
});
