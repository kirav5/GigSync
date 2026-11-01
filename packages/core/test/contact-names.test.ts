import { describe, expect, it } from "vitest";
import { matchContact, namedIn, nameKey, romanize } from "../src/index.js";

/** A name the model wrote, matched to the contact the owner saved, across scripts and spellings. */

describe("romanize", () => {
  it("writes Devanagari and Kannada names in Latin letters", () => {
    expect(romanize("रवि")).toBe("ravi");
    expect(romanize("राजू")).toBe("raajuu");
    expect(romanize("ಮೀನಾ")).toBe("miinaa");
    expect(romanize("ಲಕ್ಷ್ಮಿ")).toBe("lakshmi");
    expect(romanize("Asha")).toBe("Asha");
  });
});

describe("nameKey", () => {
  it("makes sound-alike spellings and honorifics equal", () => {
    expect(nameKey("Meena")).toBe(nameKey("मीना"));
    expect(nameKey("Laxmi")).toBe(nameKey("ಲಕ್ಷ್ಮಿ"));
    expect(nameKey("Asha didi")).toBe(nameKey("Asha"));
    expect(nameKey("Priya madam")).toBe(nameKey("प्रिया"));
  });
});

describe("matchContact", () => {
  it("returns the contact as the owner saved it, whatever script the model wrote", () => {
    expect(matchContact("Ravi", ["रवि", "मीना"])).toBe("रवि");
    expect(matchContact("Manju", ["ಮಂಜು"])).toBe("ಮಂಜು");
    expect(matchContact("asha", ["Asha didi"])).toBe("Asha didi");
  });

  it("takes one letter off only when a single contact is that close", () => {
    expect(matchContact("Meina", ["रवि", "मीना"])).toBe("मीना");
    expect(matchContact("Mina", ["Meena", "Meera"])).toBe("Meena");
    expect(matchContact("Meera", ["Meena", "Meera"])).toBe("Meera");
  });

  it("names no one for a different name, a word that is not a name, or nothing", () => {
    expect(matchContact("Meera", ["ಮೀನಾ"])).toBeUndefined();
    expect(matchContact("family", ["Raju"])).toBeUndefined();
    expect(matchContact("", ["Raju"])).toBeUndefined();
    expect(matchContact(null, ["Raju"])).toBeUndefined();
  });
});

describe("namedIn", () => {
  it("finds the contact in the message, in any script, with a case ending or an honorific", () => {
    expect(namedIn("Ravi ko mat batana main kahan hoon", "रवि")).toBe(true);
    expect(namedIn("ಲಕ್ಷ್ಮಿಗೆ ಕೊಟ್ಟಿದ್ದ ಲೊಕೇಶನ್ ಪರ್ಮಿಷನ್ ತೆಗೆದುಹಾಕಿ", "Lakshmi")).toBe(true);
    expect(namedIn("asha didi ko mera address bata sakte ho", "Asha didi")).toBe(true);
  });

  it("does not take a different name, or a message with no name, as naming the contact", () => {
    expect(namedIn("is Meena free today", "Meera")).toBe(false);
    expect(namedIn("which family asked me to come early", "Raju")).toBe(false);
  });
});
