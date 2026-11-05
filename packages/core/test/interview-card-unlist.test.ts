import { Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  type CardDraft,
  ChatRole,
  CITY_RATES,
  choose,
  fieldsFor,
  hear,
  type InterviewState,
  keywordRoute,
  prompt,
  Slot,
  start,
} from "../src/index.js";

/** ADR 0053 §7: taking the card off the board in the chat, and which sentences reach the card at all. */

const T = Trade.enum;
const AREAS = [{ key: "koramangala", names: ["Koramangala"] }];
const config = { own: "en", areas: AREAS, rates: CITY_RATES } as const;
const keys = (s: InterviewState) => prompt(s).lines.map((l) => l.key);
const CARPENTER: CardDraft = {
  trades: [T.carpenter],
  area: "koramangala",
  rate_paise: 80000,
  limit_paise: 60000,
  ask_me: [],
  auto: false,
};
const card = (offBoard = false) => start(config, CARPENTER, offBoard);
const ROUTE = { lang: "en", role: ChatRole.worker, contacts: [], trades: [T.carpenter] } as const;

describe("taking the card off the board", () => {
  it("asks first; yes takes it off, no leaves it", () => {
    const asked = choose(card(), Slot.unlist);
    expect(keys(asked)).toEqual(["iv.ask.unlist"]);
    expect(choose(asked, "yes").slot).toBe(Slot.unlisted);
    expect(choose(asked, "no").slot).toBe(Slot.confirm);
    expect(hear(hear(asked, "hmm"), "what").slot).toBe(Slot.confirm);
  });

  it("is heard in words without a change word, and not on a card already off", () => {
    expect(keywordRoute("take my card off the board", ROUTE).slots.field).toBe(Slot.unlist);
    expect(keywordRoute("मेरा कार्ड हटा दो", ROUTE).slots.field).toBe(Slot.unlist);
    expect(fieldsFor(card(true))).not.toContain(Slot.unlist);
  });

  it("a card off the board opens on putting it back", () => {
    const s = card(true);
    expect(keys(s).at(-1)).toBe("iv.confirm");
    expect(choose(s, "yes").slot).toBe(Slot.done);
  });
});

describe("what the chat routes to the card", () => {
  it.each([
    ["change my hours", Slot.hours],
    ["change my work hours", Slot.hours],
    ["change my working days", Slot.days],
    ["change how far I go", Slot.radius],
    ["change my travel distance", Slot.radius],
    ["change who buys the materials", Slot.materials],
    ["change the most hours a day", Slot.max_hours],
    ["मेरा समय बदलो", Slot.hours],
    ["ನನ್ನ ಸಮಯ ಬದಲಾಯಿಸಿ", Slot.hours],
  ])("%s", (said, field) => {
    expect(keywordRoute(said, ROUTE).slots.field).toBe(field);
  });

  it("leaves a booking to the schedule", () => {
    expect(keywordRoute("change the time of my booking tomorrow", ROUTE).slots.field).toBeUndefined();
  });
});
