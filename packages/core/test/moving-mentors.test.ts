import { City, Lang, MAX_LANDING_REQUESTS, type MentorProfile, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  AskStep,
  answerListing,
  arrivalDay,
  askStep,
  FindStep,
  findStep,
  isArrivalWeeks,
  type ListingChoices,
  ListingStep,
  listingReady,
  nextListingStep,
  shownMentors,
  startListing,
} from "../src/index.js";

const { cook, maid } = Trade.enum;
const { en, hi } = Lang.enum;
const S = ListingStep;

const CHOICES: ListingChoices = {
  first_name: "Lata",
  city: City.enum.bengaluru,
  area: "Indiranagar",
  trades: [cook],
  languages: [hi],
  woman: false,
  women_only_newcomers: false,
  slots: 2,
};

describe("finding someone who knows the city, in the chat", () => {
  it("asks the women-only question once, then searches", () => {
    expect(findStep({})).toBe(FindStep.woman);
    expect(findStep({ woman: false })).toBe(FindStep.search);
    expect(findStep({ woman: true, women_only: false })).toBe(FindStep.search);
  });

  it("shows the safety words before the first contact, then asks the week she arrives", () => {
    expect(askStep({ woman: true })).toBe(AskStep.safety);
    expect(askStep({ woman: true, safety_seen: true })).toBe(AskStep.arrival);
  });

  it("shows at most three mentors, in the server's order", () => {
    const found = ["a", "b", "c", "d"].map((user) => ({ user }) as unknown as MentorProfile);
    expect(shownMentors(found).map((m) => m.user)).toEqual(["a", "b", "c"]);
    expect(shownMentors(found)).toHaveLength(MAX_LANDING_REQUESTS);
  });

  it("names a day in the week she arrives, and takes only the weeks it offers", () => {
    const now = new Date("2026-10-30T10:00:00Z");
    expect(arrivalDay(now, 0)).toBe("2026-10-30");
    expect(arrivalDay(now, 2)).toBe("2026-11-13");
    expect(isArrivalWeeks(1)).toBe(true);
    expect(isArrivalWeeks(5)).toBe(false);
    expect(isArrivalWeeks("1")).toBe(false);
  });
});

describe("offering to help newcomers, asked as chat questions", () => {
  it("asks the area, languages, woman, slots, then confirms; trades only with more than one on the card", () => {
    let draft = startListing(CHOICES);
    expect(nextListingStep(draft, [cook])).toBe(S.area);
    draft = answerListing(draft, { step: S.area, area: "Koramangala" });
    expect(nextListingStep(draft, [cook])).toBe(S.languages);
    expect(nextListingStep(draft, [cook, maid])).toBe(S.trades);
    draft = answerListing(draft, { step: S.languages, lang: en });
    expect(draft.choices.languages).toEqual([hi, en]);
    expect(nextListingStep(draft, [cook])).toBe(S.languages);
    draft = answerListing(draft, { step: S.languages, done: true });
    expect(nextListingStep(draft, [cook])).toBe(S.woman);
    draft = answerListing(draft, { step: S.woman, woman: false });
    expect(nextListingStep(draft, [cook])).toBe(S.slots);
    draft = answerListing(draft, { step: S.slots, slots: 3 });
    expect(nextListingStep(draft, [cook])).toBe(S.confirm);
    expect(draft.choices).toMatchObject({ area: "Koramangala", slots: 3, woman: false });
    expect(listingReady(draft)).toBe(true);
  });

  it("asks a woman whether she helps women only, and never keeps women-only for anyone else", () => {
    let draft = answerListing(startListing(CHOICES), { step: S.woman, woman: true });
    expect(nextListingStep({ ...draft, asked: [S.area, S.languages, S.woman] }, [cook])).toBe(S.womenOnly);
    draft = answerListing(draft, { step: S.womenOnly, on: true });
    expect(draft.choices.women_only_newcomers).toBe(true);
    draft = answerListing(draft, { step: S.woman, woman: false });
    expect(draft.choices.women_only_newcomers).toBe(false);
  });

  it("keeps a multi-choice step open while nothing is picked, and ignores values it cannot hold", () => {
    const empty = { ...startListing({ ...CHOICES, trades: [] }), asked: [S.area] };
    expect(answerListing(empty, { step: S.trades, done: true })).toBe(empty);
    expect(listingReady(empty)).toBe(false);
    const draft = startListing(CHOICES);
    expect(answerListing(draft, { step: S.slots, slots: 99 })).toBe(draft);
    expect(answerListing(draft, { step: S.area, area: "" })).toBe(draft);
    expect(answerListing(draft, { step: S.trades, trade: "astronaut" as Trade })).toBe(draft);
  });
});
