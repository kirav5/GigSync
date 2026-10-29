import { describe, expect, it } from "vitest";
import { earningsIntent, movingIntent } from "../src/index.js";

describe("movingIntent", () => {
  it("hears a move to Bengaluru in each language", () => {
    expect(movingIntent("I'm moving to Bengaluru", "en")).toEqual({ city: "bengaluru", certain: true });
    expect(movingIntent("shifting to bangalore next month", "en")).toEqual({ city: "bengaluru", certain: true });
    expect(movingIntent("मैं बेंगलुरु जा रहा हूँ", "hi")).toEqual({ city: "bengaluru", certain: false });
    expect(movingIntent("अगले हफ़्ते बैंगलोर शिफ्ट हो रही हूँ", "hi")).toEqual({ city: "bengaluru", certain: true });
    expect(movingIntent("ನಾನು ಬೆಂಗಳೂರಿಗೆ ಹೋಗುತ್ತಿದ್ದೇನೆ", "kn")).toEqual({ city: "bengaluru", certain: false });
  });

  it("hears a move without a city, or to a city with no guide yet", () => {
    expect(movingIntent("I am moving to a new city", "en")).toEqual({ certain: true });
    expect(movingIntent("I'm moving to Chennai", "en")).toEqual({ certain: true });
    expect(movingIntent("मैं नए शहर जा रही हूँ", "hi")).toEqual({ certain: true });
    expect(movingIntent("ಹೊಸ ಊರಿಗೆ ಹೋಗುತ್ತಿದ್ದೇನೆ", "kn")).toEqual({ certain: true });
  });

  it("leaves everyday going and other requests alone", () => {
    expect(movingIntent("मैं काम पर जा रहा हूँ", "hi")).toBeUndefined();
    // An interview answer naming the city is not certain, so the card interview keeps it.
    expect(movingIntent("I work in Bengaluru", "en")?.certain).toBe(false);
    expect(movingIntent("I'm going to the market", "en")).toBeUndefined();
    expect(movingIntent("I worked in Bengaluru last year", "en")).toBeUndefined();
    expect(movingIntent("What did I earn this week?", "en")).toBeUndefined();
    expect(movingIntent("", "kn")).toBeUndefined();
  });

  it("does not take the other intents' words", () => {
    const moving = "I'm moving to Bengaluru";
    expect(earningsIntent(moving, "en")).toBe(false);
  });
});
