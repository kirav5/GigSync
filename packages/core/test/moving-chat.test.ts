import { type BoardWorker, City, Lang, MAX_RESULTS, Trade, type UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  countListed,
  documentsReply,
  estimateRequest,
  FoundBy,
  firstSteps,
  HelpIntent,
  helpIntent,
  lineString,
  movingIntent,
  namesOnlyFrom,
  phraseOutlook,
  questionReply,
  sectionReply,
  stayReply,
  workOutlook,
} from "../src/index.js";
import { COOK_MONTH } from "./estimate-fixtures.js";
import { BENGALURU, OWNER } from "./landing-fixtures.js";
import { FakeModel } from "./model-fakes.js";

const { en, hi, kn } = Lang.enum;
const { cook, maid, plumber } = Trade.enum;
const blr = City.enum.bengaluru;
const cookRequest = estimateRequest(blr, cook);
if (!cookRequest) throw new Error("the cook's default scope fails the schema");
const COOK = { request: cookRequest, estimate: COOK_MONTH };
const text = (lines: Parameters<typeof lineString>[1][], lang: Lang = en) => lines.map((l) => lineString(lang, l));

describe("offering to help newcomers, and stopping", () => {
  it("hears an offer in each language", () => {
    expect(helpIntent("I can help people new to Bengaluru", en)).toBe(HelpIntent.offer);
    expect(helpIntent("I want to become a mentor", en)).toBe(HelpIntent.offer);
    expect(helpIntent("मैं बेंगलुरु में नए लोगों की मदद कर सकती हूँ", hi)).toBe(HelpIntent.offer);
    expect(helpIntent("नए आए लोगों की मदद करना चाहता हूँ", hi)).toBe(HelpIntent.offer);
    expect(helpIntent("ಬೆಂಗಳೂರಿಗೆ ಹೊಸಬರಿಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ", kn)).toBe(HelpIntent.offer);
  });

  it("hears stopping in each language", () => {
    expect(helpIntent("stop helping newcomers", en)).toBe(HelpIntent.stop);
    expect(helpIntent("नए लोगों की मदद बंद करो", hi)).toBe(HelpIntent.stop);
    expect(helpIntent("ಹೊಸಬರಿಗೆ ಸಹಾಯ ನಿಲ್ಲಿಸಿ", kn)).toBe(HelpIntent.stop);
  });

  it("leaves a newcomer asking for help, and other words, alone", () => {
    expect(helpIntent("I'm new to Bengaluru, can someone help me?", en)).toBeUndefined();
    expect(helpIntent("मुझे बेंगलुरु में मदद चाहिए", hi)).toBeUndefined();
    expect(helpIntent("ಬೆಂಗಳೂರಿನಲ್ಲಿ ನನಗೆ ಸಹಾಯ ಬೇಕು", kn)).toBeUndefined();
    expect(helpIntent("I'm moving to Bengaluru", en)).toBeUndefined();
    expect(helpIntent("", en)).toBeUndefined();
  });

  it("is not heard as a move, and a move is not heard as an offer", () => {
    expect(movingIntent("I can help people new to Bengaluru", en)).toBeUndefined();
    expect(helpIntent("बेंगलुरु जा रहा हूँ काम के लिए", hi)).toBeUndefined();
    expect(movingIntent("बेंगलुरु जा रहा हूँ काम के लिए", hi)).toEqual({ city: blr, certain: false });
  });
});

describe("the work outlook", () => {
  it("gives the estimate's range, what it rests on and the legal minimum, the board count and the estimate note", () => {
    const outlook = workOutlook({
      city: blr,
      trades: [cook],
      own: en,
      estimates: { [cook]: COOK },
      listed: { cook: 4 },
    });
    const said = text(outlook.lines);
    expect(said[0]).toContain("₹10,000–₹12,000 a month");
    expect(said).toContain("From Bengaluru rate card: Karnataka minimum wages 2026.");
    expect(said).toContain("Nothing here is below the legal minimum of ₹6,430.");
    expect(said).toContain("On GigSync, 4 workers in Bengaluru list Cook.");
    expect(said.at(-1)).toBe("These figures are estimates from public sources, not a promise of pay.");
  });

  it("falls back to the static band and the law without an estimate, and says when a trade has no figure", () => {
    const outlook = workOutlook({ city: blr, trades: [maid, plumber], own: en, estimates: {}, listed: {} });
    const said = text(outlook.lines);
    expect(said[0]).toBe("Maid in Bengaluru: usually ₹3,500–₹8,000 a month.");
    expect(said[1]).toContain("Legal minimum for Maid");
    expect(said).toContain("Plumber: no usual range for this work yet.");
    expect(said).toContain("Researched from public sources, not yet checked by a union.");
  });

  it("says a full board page is that many or more, and has no figures for a city without a guide", () => {
    const full = workOutlook({ city: blr, trades: [cook], own: hi, estimates: {}, listed: { cook: MAX_RESULTS } });
    expect(text(full.lines, hi).join(" ")).toContain(`${MAX_RESULTS} या उससे ज़्यादा`);
    const nowhere = workOutlook({ trades: [cook], own: kn, estimates: { [cook]: COOK }, listed: {} });
    expect(nowhere.lines.map((l) => l.key)).toEqual(["moving.no_outlook"]);
  });

  it("counts the board's workers in the city without the owner, and goes without a count when it fails", async () => {
    const worker = (user: string) => ({ user }) as BoardWorker;
    const asked: unknown[] = [];
    const two = await countListed(
      async (q) => {
        asked.push(q);
        return [worker(OWNER), worker("usr_a"), worker("usr_b")];
      },
      blr,
      cook,
      OWNER,
    );
    expect(two).toBe(2);
    expect(asked[0]).toMatchObject({ trade: cook, radius_km: 30, limit: MAX_RESULTS });
    const down = await countListed(() => Promise.reject(new Error("offline")), blr, cook, "usr_x" as UserId);
    expect(down).toBeUndefined();
  });
});

describe("a model wording the outlook", () => {
  const lines = workOutlook({ city: blr, trades: [cook], own: en, estimates: { [cook]: COOK }, listed: {} }).lines;
  const reply = (words: string) => new FakeModel(JSON.stringify({ text: words }));

  it("keeps a wording whose numbers and names are all the outlook's", async () => {
    const words = "Cooks in Bengaluru usually earn ₹10,000–₹12,000 a month. These are estimates.";
    expect(await phraseOutlook(reply(words), lines, en)).toBe(words);
  });

  it("drops a wording with another number or another place, and never words Hindi or Kannada", async () => {
    expect(await phraseOutlook(reply("Cooks earn ₹15,000 a month in Bengaluru."), lines, en)).toBeUndefined();
    expect(await phraseOutlook(reply("Cooks in Whitefield earn ₹10,000 a month."), lines, en)).toBeUndefined();
    expect(await phraseOutlook(reply("कुक ₹10,000 कमाते हैं।"), lines, hi)).toBeUndefined();
    expect(await phraseOutlook(undefined, lines, en)).toBeUndefined();
  });

  it("finds names only past the start of a sentence", () => {
    expect(namesOnlyFrom("Usually ₹10,000. These are estimates.", "Cook in Bengaluru")).toBe(true);
    expect(namesOnlyFrom("Usually ₹10,000 in Mysuru.", "Cook in Bengaluru")).toBe(false);
  });
});

describe("answers from the guide in a chat about a move", () => {
  it("lists what to sort first: a place to stay, a SIM, a bank account, documents, registration", () => {
    expect(firstSteps(BENGALURU).map((s) => s.id)).toEqual([
      "first-nights-women-hostels",
      "sim-card",
      "bank-account-current-address",
      "aadhaar-address-update",
      "e-shram",
    ]);
  });

  it("answers where to stay with the hostels section and the places to stay, and documents with their sections", () => {
    const stay = stayReply(BENGALURU);
    expect(stay.section?.id).toBe("first-nights-women-hostels");
    expect(stay.places?.length).toBeGreaterThan(0);
    expect(stay.places?.every((p) => p.kind === "housing")).toBe(true);
    expect(documentsReply(BENGALURU).topics?.map((s) => s.id)).toContain("bank-account-current-address");
    expect(sectionReply(BENGALURU, "upi-id").section?.title).toContain("UPI");
    expect(sectionReply(BENGALURU, "no-such-section").section).toBeUndefined();
  });

  it("answers follow-up questions in each language with the guide's section as written", async () => {
    const bank = await questionReply(BENGALURU, "how do I open a bank account", { lang: en });
    expect(bank?.section?.id).toBe("bank-account-current-address");
    expect(bank?.by).toBe(FoundBy.words);
    expect(bank?.places).toBeUndefined();
    const stay = await questionReply(BENGALURU, "रहने की जगह कहाँ मिलेगी?", { lang: hi });
    expect(stay?.section?.id).toBe("first-nights-women-hostels");
    expect(stay?.places?.length).toBeGreaterThan(0);
    const sim = await questionReply(BENGALURU, "ಸಿಮ್ ಬೇಕು", { lang: kn });
    expect(sim?.section?.id).toBe("sim-card");
    expect(await questionReply(BENGALURU, "where can I buy a saree", { lang: en })).toBeUndefined();
  });
});
