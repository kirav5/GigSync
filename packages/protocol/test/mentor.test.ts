import { describe, expect, it } from "vitest";
import {
  BODY,
  ColleagueLink,
  EnvelopeKind,
  LinkKind,
  LinkStep,
  LinkTerms,
  MATCH_LIMIT,
  MatchRequest,
  MatchResponse,
  MENTOR_KINDS,
  MENTOR_MIN_JOBS,
  MENTOR_MIN_MONTHS,
  MentorAccept,
  MentorListing,
  MentorOffer,
  MentorProfile,
  MentorReply,
  MentorReport,
  MentorVouch,
} from "../src/index.js";

const USER = "usr_01J0000000000000000000AAAA";
const listing = {
  first_name: "Meena",
  city: "bengaluru",
  area: "Indiranagar",
  trades: ["cook"],
  languages: ["kn", "hi"],
  months: MENTOR_MIN_MONTHS,
  jobs: MENTOR_MIN_JOBS,
  woman: true,
};
const card = { name: "Meena", trades: ["cook"], languages: ["kn"], months: 8, jobs: 31 };

describe("mentor listing", () => {
  it("fills in two open slots, active, and not women-only", () => {
    const parsed = MentorListing.parse(listing);
    expect(parsed).toMatchObject({ open_slots: 2, active: true, women_only_newcomers: false });
  });

  it("needs the minimum record and distinct trades", () => {
    expect(MentorListing.safeParse({ ...listing, months: MENTOR_MIN_MONTHS - 1 }).success).toBe(false);
    expect(MentorListing.safeParse({ ...listing, jobs: MENTOR_MIN_JOBS - 1 }).success).toBe(false);
    expect(MentorListing.safeParse({ ...listing, trades: ["cook", "cook"] }).success).toBe(false);
    expect(MentorListing.safeParse({ ...listing, city: "mumbai" }).success).toBe(false);
  });

  it("keeps the woman flag out of the public profile", () => {
    const profile = MentorProfile.parse({ ...listing, user: USER, vouched_by: null });
    expect(profile).not.toHaveProperty("woman");
    expect(profile).not.toHaveProperty("women_only_newcomers");
  });
});

describe("matching", () => {
  it("defaults to not women-only and caps the answer", () => {
    expect(MatchRequest.parse({ city: "bengaluru", trade: "cook", lang: "kn" })).toMatchObject({
      women_only: false,
      woman: false,
    });
    const profile = { ...listing, user: USER, vouched_by: null };
    const tooMany = Array.from({ length: MATCH_LIMIT + 1 }, () => profile);
    expect(MatchResponse.safeParse({ mentors: tooMany }).success).toBe(false);
  });

  it("takes only listed reasons and a vouch that can be cleared", () => {
    expect(MentorReport.safeParse({ user: USER, reason: "asked_money" }).success).toBe(true);
    expect(MentorReport.safeParse({ user: USER, reason: "call me on 98..." }).success).toBe(false);
    expect(MentorVouch.safeParse({ user: USER, vouched_by: null }).success).toBe(true);
  });
});

describe("mentor envelopes", () => {
  it("are side kinds with a body schema each", () => {
    expect(MENTOR_KINDS.size).toBe(4);
    for (const k of MENTOR_KINDS) expect(BODY[k]).toBeDefined();
    expect(MENTOR_KINDS.has(EnvelopeKind.enum.landing_request)).toBe(true);
  });

  it("an accepting offer carries the mentor's card, with no badge by default", () => {
    expect(MentorOffer.safeParse({ reply: MentorReply.enum.accept }).success).toBe(false);
    expect(MentorOffer.parse({ reply: MentorReply.enum.accept, card }).card?.vouched_by).toBeNull();
    expect(MentorOffer.safeParse({ reply: MentorReply.enum.decline }).success).toBe(true);
    expect(MentorOffer.safeParse({ reply: MentorReply.enum.withdraw }).success).toBe(false);
    expect(MentorAccept.safeParse({ reply: MentorReply.enum.withdraw }).success).toBe(true);
  });

  it("parses a landing request and an introduction", () => {
    const request = { card, city: "bengaluru", trade: "cook", languages: ["hi"], arrival_week: "2026-11-09" };
    expect(BODY.landing_request.safeParse(request).success).toBe(true);
    expect(BODY.landing_request.safeParse({ ...request, arrival_week: "next week" }).success).toBe(false);
    const intro = { other: USER, card, city: "bengaluru", other_role: "mentor", by: { user: USER, name: "Ravi" } };
    expect(BODY.introduce.safeParse(intro).success).toBe(true);
  });
});

describe("mentor links", () => {
  it("an old stored link parses as a colleague link without expiry", () => {
    expect(LinkTerms.parse({})).toEqual({ kind: LinkKind.enum.colleague });
  });

  it("a renewal needs the new expiry", () => {
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.renew }).success).toBe(false);
    const renew = { step: LinkStep.enum.renew, expires_at: "2026-12-01T00:00:00+05:30" };
    expect(ColleagueLink.safeParse(renew).success).toBe(true);
  });
});
