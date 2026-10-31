import { Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { editIntent, Slot } from "../src/index.js";
import { areaIn, fieldIn, isNone, isSkip, languagesIn, tradesIn, yesNo } from "../src/interview/lexicon.js";
import { normalize } from "../src/interview/normalize.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್", "HSR", "ಎಚ್‌ಎಸ್‌ಆರ್"] },
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
  { key: "whitefield", names: ["Whitefield", "व्हाइटफ़ील्ड", "ವೈಟ್‌ಫೀಲ್ಡ್"] },
];

describe("normalization", () => {
  it("drops zero-width joiners and the nukta, and evens out chandrabindu", () => {
    expect(normalize("ಎಚ್‌ಎಸ್‌ಆರ್")).toBe("ಎಚ್ಎಸ್ಆರ್");
    expect(normalize("हज़ार")).toBe(normalize("हजार"));
    expect(normalize("बढ़ई")).toBe("बढई");
    expect(normalize("हाँ")).toBe(normalize("हां"));
  });

  it("turns sentence punctuation into spaces but keeps points and commas inside numbers", () => {
    expect(normalize("Yes. OK!  Fine?")).toBe("yes ok fine");
    expect(normalize("हाँ। ठीक है")).toBe(normalize("हाँ ठीक है"));
    expect(normalize("₹1,20,000 or 8.5")).toBe("₹1,20,000 or 8.5");
  });
});

describe("trades", () => {
  it.each([
    ["I am a cook", T.cook],
    ["main cook hoon", T.cook],
    ["मैं खाना बनाती हूँ", T.cook],
    ["ಅಡುಗೆ ಮಾಡುತ್ತೇನೆ", T.cook],
    ["house work and cleaning", T.maid],
    ["घर का काम करती हूँ", T.maid],
    ["ಮನೆಗೆಲಸ", T.maid],
    ["electrician", T.electrician],
    ["बिजली का काम", T.electrician],
    ["ಕರೆಂಟ್ ಕೆಲಸ", T.electrician],
    ["plumbing", T.plumber],
    ["नल ठीक करता हूँ", T.plumber],
    ["ಪ್ಲಂಬರ್", T.plumber],
    ["carpenter", T.carpenter],
    ["बढ़ई", T.carpenter],
    ["ಬಡಗಿ", T.carpenter],
    ["AC repair", T.ac_technician],
    ["एसी ठीक करता हूँ", T.ac_technician],
    ["ಎಸಿ ರಿಪೇರಿ", T.ac_technician],
    ["painting", T.painter],
    ["पुताई", T.painter],
    ["ಪೇಂಟರ್", T.painter],
    ["driver", T.driver],
    ["गाड़ी चलाता हूँ", T.driver],
    ["ಡ್ರೈವರ್", T.driver],
  ])("hears %s as %s", (text, trade) => {
    expect(tradesIn(text)).toEqual([trade]);
  });

  it("allows several trades, in the order said", () => {
    expect(tradesIn("मैं खाना बनाती हूँ और बर्तन भी")).toEqual([T.cook, T.maid]);
  });

  it("needs a whole word for short entries", () => {
    expect(tradesIn("मेरा नाम लता है")).toEqual([]);
    expect(tradesIn("I teach")).toEqual([]);
  });
});

describe("yes and no", () => {
  it.each([
    ["हाँ", true],
    ["हां जी", true],
    ["ठीक है", true],
    ["हाँ ना", true],
    ["कर दो ना", true],
    ["ಹೌದು", true],
    ["ಸರಿ", true],
    ["okay", true],
    ["ना", false],
    ["ना, मत करो", false],
    ["नहीं", false],
    ["हाँ नहीं", false],
    ["ಬೇಡ", false],
    ["no", false],
    ["कुछ और", undefined],
  ])("hears %s as %s", (text, yes) => {
    expect(yesNo(text)).toBe(yes);
  });

  it("does not find ना inside खाना", () => {
    expect(yesNo("खाना")).toBeUndefined();
  });

  it("knows skip and none", () => {
    expect(isSkip("छोड़ो")).toBe(true);
    expect(isSkip("ಬಿಡಿ")).toBe(true);
    expect(isSkip("skip")).toBe(true);
    expect(isSkip("दस साल से खाना बनाती हूँ, कुछ नहीं छोड़ती")).toBe(false);
    expect(isNone("कोई नहीं")).toBe(true);
    expect(isNone("ಯಾವುದೂ ಇಲ್ಲ")).toBe(true);
  });
});

describe("languages", () => {
  it("names languages in any script, in the order said", () => {
    expect(languagesIn("हिंदी और इंग्लिश")).toEqual(["hi", "en"]);
    expect(languagesIn("ಕನ್ನಡ, ಇಂಗ್ಲಿಷ್")).toEqual(["kn", "en"]);
    expect(languagesIn("Kannada")).toEqual(["kn"]);
    expect(languagesIn("अंग्रेज़ी")).toEqual(["en"]);
  });
});

describe("areas", () => {
  it("finds an area inside a sentence", () => {
    expect(areaIn("मैं कोरमंगला में काम करती हूँ", AREAS)).toBe("koramangala");
    expect(areaIn("ಜಯನಗರದಲ್ಲಿ", AREAS)).toBe("jayanagar");
  });

  it("finds an area with a letter wrong", () => {
    expect(areaIn("कोरमंगल", AREAS)).toBe("koramangala");
    expect(areaIn("Jaynagar", AREAS)).toBe("jayanagar");
  });

  it("finds a name written with or without zero-width joiners", () => {
    expect(areaIn("ಎಚ್‌ಎಸ್‌ಆರ್", AREAS)).toBe("hsr_layout");
    expect(areaIn("ಎಚ್ಎಸ್ಆರ್", AREAS)).toBe("hsr_layout");
  });

  it("does not stretch a short name to a near word", () => {
    expect(areaIn("near her house", AREAS)).toBeUndefined();
    expect(areaIn("पता नहीं", AREAS)).toBeUndefined();
  });
});

describe("changing the card from Talk", () => {
  it("needs a change word and a field word together", () => {
    expect(editIntent("मेरा रेट बदलो")).toBe(Slot.rate);
    expect(editIntent("change my rate")).toBe(Slot.rate);
    expect(editIntent("ನನ್ನ ದರ ಬದಲಾಯಿಸಿ")).toBe(Slot.rate);
    expect(editIntent("सबसे कम दाम बदलना है")).toBe(Slot.min);
    expect(editIntent("change my area")).toBe(Slot.area);
    expect(editIntent("पैसे याद रखना")).toBeUndefined();
    expect(editIntent("change my card")).toBeUndefined();
  });

  it("names a field on its own when asked what to change", () => {
    expect(fieldIn("दाम")).toBe(Slot.rate);
    expect(fieldIn("ದರ")).toBe(Slot.rate);
    expect(fieldIn("इलाक़ा")).toBe(Slot.area);
    expect(fieldIn("कुछ नहीं")).toBeUndefined();
  });
});
