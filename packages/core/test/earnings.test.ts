import { describe, expect, it } from "vitest";
import { earningsIntent } from "../src/router/earnings.js";

describe("earningsIntent", () => {
  it("hears a question about earnings in each language", () => {
    expect(earningsIntent("What did I earn this week?", "en")).toBe(true);
    expect(earningsIntent("इस हफ़्ते मैंने कितना कमाया?", "hi")).toBe(true);
    expect(earningsIntent("is hafte kitne paise mile", "hi")).toBe(true);
    expect(earningsIntent("ಈ ವಾರ ನಾನು ಎಷ್ಟು ಸಂಪಾದಿಸಿದೆ?", "kn")).toBe(true);
  });

  it("leaves other words alone", () => {
    expect(earningsIntent("change my rate", "en")).toBe(false);
    expect(earningsIntent("मेरा रेट बदलो", "hi")).toBe(false);
    expect(earningsIntent("remember the 3rd floor customer", "en")).toBe(false);
    expect(earningsIntent("", "kn")).toBe(false);
  });
});
