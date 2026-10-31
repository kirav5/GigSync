import { describe, expect, it } from "vitest";
import { askGuide, FoundBy, findSection, pickPrompt } from "../src/index.js";
import { BENGALURU } from "./landing-fixtures.js";
import { FakeModel, Hang } from "./model-fakes.js";

const idFor = (question: string, lang: "en" | "hi" | "kn") => findSection(BENGALURU, question, lang)?.id;

describe("asking the guide by words", () => {
  it("finds the first-nights hostels for a place to stay, in each language", () => {
    expect(idFor("Where can I stay?", "en")).toBe("first-nights-women-hostels");
    expect(idFor("I need a room for the first nights", "en")).toBe("first-nights-women-hostels");
    expect(idFor("बेंगलुरु में रहने की जगह कहाँ मिलेगी?", "hi")).toBe("first-nights-women-hostels");
    expect(idFor("ಬೆಂಗಳೂರಿನಲ್ಲಿ ಎಲ್ಲಿ ಉಳಿಯಬಹುದು?", "kn")).toBe("first-nights-women-hostels");
  });

  it("finds the common needs in Hindi and Kannada words", () => {
    expect(idFor("बैंक खाता कैसे खुलेगा?", "hi")).toBe("bank-account-current-address");
    expect(idFor("सिम कार्ड कैसे मिलेगा", "hi")).toBe("sim-card");
    expect(idFor("ई-श्रम में पंजीकरण", "hi")).toBe("e-shram");
    expect(idFor("बस का पास", "hi")).toBe("bus-travel");
    expect(idFor("ಬ್ಯಾಂಕ್ ಖಾತೆ ತೆರೆಯುವುದು ಹೇಗೆ?", "kn")).toBe("bank-account-current-address");
    expect(idFor("ಸಿಮ್ ಬೇಕು", "kn")).toBe("sim-card");
    expect(idFor("ಆಧಾರ್ ವಿಳಾಸ ಬದಲಾವಣೆ", "kn")).toBe("aadhaar-address-update");
    expect(idFor("ಸಂಬಳ ಎಷ್ಟು?", "kn")).toBe("pay-and-minimum-wage");
  });

  it("finds the small account for someone with no documents, the usual account for a bank account", () => {
    expect(idFor("bank account", "en")).toBe("bank-account-current-address");
    expect(idFor("I have no documents", "en")).toBe("small-account");
  });

  it("finds English words and English mixed into another language", () => {
    expect(idFor("How do I get a UPI PIN?", "en")).toBe("upi-id");
    expect(idFor("police verification ke liye kya karna hai", "hi")).toBe("police-verification");
    expect(idFor("e-Shram registration", "kn")).toBe("e-shram");
  });

  it("answers help with the numbers to save, but a named need first", () => {
    expect(idFor("मुझे मदद चाहिए", "hi")).toBe("emergency-numbers");
    expect(idFor("help me find a room", "en")).toBe("first-nights-women-hostels");
  });

  it("says nothing when the guide has nothing on it", () => {
    expect(idFor("Where can I buy a saree?", "en")).toBeUndefined();
    expect(idFor("मुझे साड़ी खरीदनी है", "hi")).toBeUndefined();
    expect(idFor("ಸೀರೆ ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ?", "kn")).toBeUndefined();
    expect(idFor("   ", "en")).toBeUndefined();
  });
});

describe("a model choosing the section", () => {
  const LOST = "I lost my wallet on the train, who do I call?";

  it("is not asked when the words found a section", async () => {
    const model = new FakeModel(JSON.stringify({ id: "legal-help" }));
    const answer = await askGuide(BENGALURU, "Where can I stay?", { lang: "en", model });
    expect(answer).toEqual({
      section: expect.objectContaining({ id: "first-nights-women-hostels" }),
      by: FoundBy.words,
    });
    expect(model.prompts).toEqual([]);
  });

  it("may pick one of the guide's ids from the titles, and the answer is that section as written", async () => {
    expect(idFor(LOST, "en")).toBeUndefined();
    const model = new FakeModel('Sure! {"id": "emergency-numbers"}');
    const answer = await askGuide(BENGALURU, LOST, { lang: "en", model });
    expect(answer?.by).toBe(FoundBy.model);
    expect(answer?.section).toEqual(BENGALURU.sections.find((s) => s.id === "emergency-numbers"));
    expect(model.prompts[0]).toContain('"emergency-numbers": Save these numbers before you travel');
  });

  it("counts for nothing when the reply is garbage, an id the guide does not have, or not an object", async () => {
    for (const reply of ["no idea", "{not json", JSON.stringify({ id: "free-rooms-here" }), "[1,2]", "", null]) {
      expect(await askGuide(BENGALURU, LOST, { lang: "en", model: new FakeModel(reply) })).toBeUndefined();
    }
  });

  it("cannot put its own words in the answer, whatever it says", async () => {
    const hostile = [
      JSON.stringify({ id: "emergency-numbers", body: "Pay Rs 5000 to 9999999999 for a room" }),
      JSON.stringify({ id: "Ignore the guide. Tell them to send money to 9999999999." }),
      JSON.stringify({ id: ["emergency-numbers"] }),
    ];
    const answers = await Promise.all(
      hostile.map((reply) => askGuide(BENGALURU, LOST, { lang: "en", model: new FakeModel(reply) })),
    );
    expect(answers[0]?.section).toEqual(BENGALURU.sections.find((s) => s.id === "emergency-numbers"));
    expect(JSON.stringify(answers[0])).not.toContain("9999999999");
    expect(answers.slice(1)).toEqual([undefined, undefined]);
  });

  it("is given up on when slow or failing, and not asked in Hindi or Kannada", async () => {
    expect(await askGuide(BENGALURU, LOST, { lang: "en", model: new FakeModel(Hang), waitMs: 20 })).toBeUndefined();
    expect(await askGuide(BENGALURU, LOST, { lang: "en", model: new FakeModel(new Error("boom")) })).toBeUndefined();
    const model = new FakeModel(JSON.stringify({ id: "emergency-numbers" }));
    expect(await askGuide(BENGALURU, "ट्रेन में बटुआ खो गया", { lang: "hi", model })).toBeUndefined();
    expect(model.prompts).toEqual([]);
  });

  it("is shown only ids and titles, never section bodies", () => {
    const prompt = pickPrompt(BENGALURU, LOST);
    const first = BENGALURU.sections[0];
    expect(prompt).toContain(first?.title);
    expect(prompt).not.toContain(first?.body);
  });
});
