import type { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { editIntent, hireIntent } from "../src/index.js";

const asks: readonly [Lang, string][] = [
  ["en", "I want to hire someone for tomorrow"],
  ["en", "Need a helper for a big wiring job"],
  ["en", "I need someone to carry the ladder"],
  ["en", "I need a good plumber on Saturday"],
  ["en", "need an AC technician"],
  ["hi", "मुझे कल एक हेल्पर चाहिए"],
  ["hi", "काम के लिए हेल्पर्स चाहिए"],
  ["hi", "मदद के लिए कोई चाहिए"],
  ["hi", "किसी को रखना है"],
  ["hi", "एक आदमी को काम पर रखना है"],
  ["hi", "kal ke liye kisi ko rakhna hai"],
  ["hi", "mujhe helper chahiye"],
  ["kn", "ನಾಳೆಗೆ ಒಬ್ಬ ಸಹಾಯಕ ಬೇಕು"],
  ["kn", "ಸಹಾಯಕರು ಬೇಕು"],
  ["kn", "ಕೆಲಸಕ್ಕೆ ಯಾರಾದರೂ ಬೇಕು"],
  ["kn", "ಒಬ್ಬ ಹೆಲ್ಪರ್ ಬೇಕು"],
];

const notAsks: readonly [Lang, string][] = [
  ["en", "change my rate"],
  ["en", "Priya hired me for Saturday"],
  ["en", "remember Priya pays on Fridays"],
  ["en", "what did I note about the gate code?"],
  ["en", "how much should I charge to fix a fan"],
  ["en", "do I need a license to be an electrician"],
  ["en", "who needs a cook near me"],
  ["en", "I need a break"],
  ["en", "I need someone's number"],
  ["hi", "मेरा रेट बदलो"],
  ["hi", "मेरी मदद करो"],
  ["hi", "प्रिया शुक्रवार को पैसे देती है, याद रखना"],
  ["kn", "ನನ್ನ ದರ ಬದಲಾಯಿಸು"],
  ["kn", "ನನಗೆ ಸಹಾಯ ಮಾಡಿ"],
  ["kn", "ಸಹಾಯಕ್ಕೆ ಧನ್ಯವಾದ"],
  ["en", ""],
];

describe("hireIntent", () => {
  it.each(asks)("hears a request to hire in %s: %s", (lang, text) => {
    expect(hireIntent(text, lang)).toBe(true);
  });

  it.each(notAsks)("stays quiet in %s: %s", (lang, text) => {
    expect(hireIntent(text, lang)).toBe(false);
  });

  it("leaves changing the card to the interview", () => {
    for (const text of ["change my rate", "मेरा रेट बदलो", "ನನ್ನ ದರ ಬದಲಾಯಿಸು"]) {
      expect(editIntent(text)).toBe("rate");
      expect(hireIntent(text, "hi")).toBe(false);
    }
  });

  it("counts English words in every language, and only the owner's own language for the rest", () => {
    expect(hireIntent("helper chahiye", "kn")).toBe(true);
    expect(hireIntent("ಸಹಾಯಕ ಬೇಕು", "hi")).toBe(false);
  });
});
