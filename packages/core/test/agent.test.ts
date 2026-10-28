import { newDeviceSecrets } from "@gigsync/crypto";
import { describe, expect, it } from "vitest";
import { Agent, MemoryStorage, NoModel, routeByKeywords, SecretKeys } from "../src/index.js";

const fakeKeys = new SecretKeys(newDeviceSecrets());

describe("keyword router", () => {
  it("routes the common shapes", () => {
    const c = ["Meera", "Raju"];
    expect(routeByKeywords("remember Kabir prefers tea", c).expert).toBe("remember");
    expect(routeByKeywords("is Meera free on Friday?", c)).toMatchObject({ expert: "askContact", contact: "Meera" });
    expect(routeByKeywords("let Meera see where I am today", c).expert).toBe("setRule");
    expect(routeByKeywords("need an electrician tomorrow", c).expert).toBe("find");
    expect(routeByKeywords("what did Arjun say about the trip?", c).expert).toBe("askSelf");
    expect(routeByKeywords("hello there", c).expert).toBe("chat");
  });
});

describe("agent without a model", () => {
  it("saves a note and answers from it", async () => {
    const storage = new MemoryStorage();
    const agent = new Agent({ storage, keys: fakeKeys, model: new NoModel(), clock: { now: () => new Date() } });
    const saved = await agent.handle("remember Arjun said the trip is on 3 Nov");
    expect(saved.card.kind).toBe("saved");
    const asked = await agent.handle("what did Arjun say about the trip?");
    expect(asked.card.kind).toBe("answer");
    if (asked.card.kind === "answer" && "words" in asked.card) {
      expect(asked.card.words.text).toContain("3 Nov");
      expect(asked.card.sources).toHaveLength(1);
    }
  });
  it("says it needs a model instead of guessing", async () => {
    const agent = new Agent({
      storage: new MemoryStorage(),
      keys: fakeKeys,
      model: new NoModel(),
      clock: { now: () => new Date() },
    });
    expect((await agent.handle("tell me a joke")).card.kind).toBe("needs_model");
  });
  it("drafts an engagement to a known contact", async () => {
    const storage = new MemoryStorage();
    await storage.put("contacts", "c1", { id: "usr_01J0000000000000000000AAAA", name: "Meera" });
    const agent = new Agent({ storage, keys: fakeKeys, model: new NoModel(), clock: { now: () => new Date() } });
    const { card } = await agent.handle("is Meera free on Friday?");
    expect(card.kind).toBe("draft");
    if (card.kind === "draft") expect(card.engagement.status).toBe("draft");
  });
});

describe("the agent in Hindi and Kannada", () => {
  const fresh = () =>
    new Agent({ storage: new MemoryStorage(), keys: fakeKeys, model: new NoModel(), clock: { now: () => new Date() } });

  it("routes notes and questions written in Devanagari and Kannada script", () => {
    expect(routeByKeywords("याद रखना: रविवार मेरी छुट्टी है", [])).toEqual({
      expert: "remember",
      text: "रविवार मेरी छुट्टी है",
    });
    expect(routeByKeywords("रविवार मेरी छुट्टी है, याद रखना", []).expert).toBe("remember");
    expect(routeByKeywords("ನೆನಪಿಡು: ಭಾನುವಾರ ರಜೆ", []).text).toBe("ಭಾನುವಾರ ರಜೆ");
    expect(routeByKeywords("मुझे प्लंबर चाहिए", []).expert).toBe("find");
    expect(routeByKeywords("ಮೀರಾ ಬಗ್ಗೆ ನಾನು ಏನು ಬರೆದಿದ್ದೆ?", ["ಮೀರಾ"])).toMatchObject({ contact: "ಮೀರಾ" });
  });

  it("saves a Hindi note and finds it again from a Hindi question", async () => {
    const agent = fresh();
    expect((await agent.handle("याद रखना: तीसरी मंज़िल वाले ग्राहक 5 तारीख़ को पैसे देते हैं")).card).toMatchObject({
      kind: "saved",
      say: { key: "agent.saved" },
    });
    const asked = (await agent.handle("तीसरी मंज़िल वाले ग्राहक के बारे में मैंने क्या लिखा था?")).card;
    expect(asked.kind).toBe("answer");
    expect("words" in asked && asked.words.text).toContain("5 तारीख़");
  });

  it("finds a Kannada note from a Kannada question", async () => {
    const agent = fresh();
    await agent.handle("ನೆನಪಿಡು: ಮೂರನೇ ಮಹಡಿಯ ಗ್ರಾಹಕರು 5ನೇ ತಾರೀಖು ಪಾವತಿಸುತ್ತಾರೆ");
    const asked = (await agent.handle("ಮೂರನೇ ಮಹಡಿಯ ಗ್ರಾಹಕರ ಬಗ್ಗೆ ನಾನು ಏನು ಬರೆದಿದ್ದೆ?")).card;
    expect("words" in asked && asked.words.text).toContain("5ನೇ");
  });
});
