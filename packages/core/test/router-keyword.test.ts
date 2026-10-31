import { Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ChatIntent, ChatRole, type IntentContext, keywordRoute, RouteVia } from "../src/index.js";

/** The word lists as one router (ADR 0040): the chats' old chain, in its old order, for lite mode. */

const { en, hi, kn } = Lang.enum;
const I = ChatIntent;
const worker = (lang: Lang, more: Partial<IntentContext> = {}): IntentContext => ({
  lang,
  role: ChatRole.worker,
  contacts: ["Meera", "ಮೀರಾ"],
  trades: [Trade.enum.cook],
  ...more,
});
const household = (lang: Lang): IntentContext => ({ lang, role: ChatRole.household, contacts: [] });

describe("keywordRoute for a worker's Talk", () => {
  const cases: readonly [string, IntentContext, ChatIntent, object][] = [
    ["change my rate", worker(en), I.editCard, { field: "rate" }],
    ["मेरा रेट बदलो", worker(hi), I.editCard, { field: "rate" }],
    ["ನನ್ನ ದರ ಬದಲಾಯಿಸಿ", worker(kn), I.editCard, { field: "rate" }],
    ["I want to help newcomers", worker(en), I.helpOffer, {}],
    ["नए लोगों की मदद करूँगी", worker(hi), I.helpOffer, {}],
    ["stop helping", worker(en), I.helpStop, {}],
    ["I'm moving to Bengaluru", worker(en), I.moving, { city: "bengaluru" }],
    ["मैं बेंगलुरु जा रहा हूँ", worker(hi), I.moving, { city: "bengaluru" }],
    ["ಹೊಸ ಊರಿಗೆ ಶಿಫ್ಟ್ ಆಗುತ್ತಿದ್ದೇನೆ", worker(kn), I.moving, {}],
    ["what do cooks charge in Jayanagar?", worker(en), I.market, { trade: "cook", area: "jayanagar" }],
    ["जयनगर में रेट कितना है", worker(hi), I.market, { trade: "cook", area: "jayanagar" }],
    ["ಪ್ಲಂಬರ್ ದರ ಎಷ್ಟು", worker(kn), I.market, { trade: "plumber" }],
    ["how much did I earn this week?", worker(en), I.earnings, {}],
    ["इस हफ़्ते कितनी कमाई हुई", worker(hi), I.earnings, {}],
    ["ಈ ವಾರ ಎಷ್ಟು ಸಂಪಾದನೆ", worker(kn), I.earnings, {}],
    ["remember Kabir prefers tea", worker(en), I.remember, { note: "Kabir prefers tea" }],
    ["याद रखना: रविवार मेरी छुट्टी है", worker(hi), I.remember, { note: "रविवार मेरी छुट्टी है" }],
    ["ನೆನಪಿಡು: ಭಾನುವಾರ ರಜೆ", worker(kn), I.remember, { note: "ಭಾನುವಾರ ರಜೆ" }],
    ["let Meera see where I am today", worker(en), I.setRule, { contact: "Meera" }],
    ["need an electrician tomorrow", worker(en), I.find, {}],
    ["मुझे प्लंबर चाहिए", worker(hi), I.find, {}],
    ["is Meera free on Friday?", worker(en), I.askContact, { contact: "Meera" }],
    ["what did Arjun say about the trip?", worker(en), I.askSelf, {}],
    ["ಮೀರಾ ಬಗ್ಗೆ ನಾನು ಏನು ಬರೆದಿದ್ದೆ?", worker(kn), I.askSelf, { contact: "ಮೀರಾ" }],
    ["hello there", worker(en), I.chat, {}],
    // The lists never heard these: the model's work (ADR 0040's context).
    ["is ₹8,000 fair for a cook?", worker(en), I.chat, {}],
  ];
  it.each(cases)("%s", (text, ctx, intent, slots) => {
    expect(keywordRoute(text, ctx)).toEqual({ intent, slots, via: RouteVia.keywords });
  });

  it("keeps the old order: a card change wins over a price word, a move over a market question", () => {
    expect(keywordRoute("change my price", worker(en)).intent).toBe(I.editCard);
    expect(keywordRoute("moving to Bengaluru, what do cooks charge there?", worker(en)).intent).toBe(I.moving);
  });

  it("hears a move only when it is the owner's own", () => {
    expect(keywordRoute("my brother is moving to Bengaluru", worker(en)).intent).not.toBe(I.moving);
    expect(keywordRoute("मेरा भाई बेंगलुरु जा रहा है", worker(hi)).intent).not.toBe(I.moving);
    expect(keywordRoute("ನನ್ನ ತಮ್ಮ ಬೆಂಗಳೂರಿಗೆ ಹೋಗುತ್ತಿದ್ದಾನೆ", worker(kn)).intent).not.toBe(I.moving);
    expect(keywordRoute("moving to Bengaluru with my wife", worker(en)).intent).toBe(I.moving);
    expect(keywordRoute("ಬೆಂಗಳೂರಿಗೆ ಹೋಗುತ್ತಿದ್ದೇನೆ", worker(kn)).intent).toBe(I.moving);
  });

  it("hears the guide only in a chat about a move", () => {
    expect(keywordRoute("where can I find a room to stay?", worker(en, { inMove: true })).intent).toBe(I.guide);
    expect(keywordRoute("where can I find a room to stay?", worker(en)).intent).not.toBe(I.guide);
  });

  it("asks the area's rate for the worker's own trade only when they have one", () => {
    expect(keywordRoute("what is the rate in Jayanagar?", worker(en, { trades: [] })).intent).not.toBe(I.market);
  });
});

describe("keywordRoute for a household", () => {
  it("hears a market question, then finding, notes, questions and the rest", () => {
    expect(keywordRoute("what do painters charge in HSR?", household(en))).toMatchObject({
      intent: I.market,
      slots: { trade: "painter", area: "hsr_layout" },
    });
    expect(keywordRoute("जयनगर में कुक कितना लेते हैं", household(hi)).intent).toBe(I.market);
    expect(keywordRoute("ಜಯನಗರದಲ್ಲಿ ಅಡುಗೆಯವರ ದರ ಎಷ್ಟು", household(kn)).intent).toBe(I.market);
    expect(keywordRoute("need a cook, pay 12000", household(en)).intent).toBe(I.find);
    expect(keywordRoute("मुझे प्लंबर चाहिए", household(hi)).intent).toBe(I.find);
    expect(keywordRoute("remember the plumber comes on Monday", household(en))).toMatchObject({
      intent: I.remember,
      slots: { note: "the plumber comes on Monday" },
    });
    expect(keywordRoute("what did I note about the painter?", household(en)).intent).toBe(I.askSelf);
    expect(keywordRoute("thanks", household(en)).intent).toBe(I.chat);
    // A worker's lists are not a household's.
    expect(keywordRoute("change my rate", household(en)).intent).toBe(I.chat);
    expect(keywordRoute("I'm moving to Bengaluru", household(en)).intent).toBe(I.chat);
  });
});
