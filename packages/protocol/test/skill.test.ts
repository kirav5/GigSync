import { describe, expect, it } from "vitest";
import {
  BoardProfile,
  BoardQuery,
  JobRecordSubmit,
  JobRequest,
  JobTerms,
  MAX_SKILLS,
  MyBoardProfile,
  SkillProblem,
  skillKey,
  skillProblem,
  termsFit,
} from "../src/index.js";

const area = { lat: 12.97, lon: 77.64 };
const card = { display_name: "Lakshmi", trades: [], area, area_name: "Jayanagar", rate_paise: 40000 };
const tailor = { text: "Tailor", lang: "en" } as const;
const P = SkillProblem.enum;

describe("a skill in a worker's own words (ADR 0047)", () => {
  it("has one key however it is typed", () => {
    expect(skillKey("  Tailor ")).toBe("tailor");
    expect(skillKey("TAILOR")).toBe("tailor");
    expect(skillKey("Mehendi / Henna")).toBe("mehendi henna");
    expect(skillKey("ತೋಟದ  ಕೆಲಸ")).toBe("ತೋಟದ ಕೆಲಸ");
  });

  it("takes a name for work in any script", () => {
    for (const ok of ["Tailor", "Garden work", "मेहंदी", "ದರ್ಜಿ", "Pet-sitting", "Saree draping & pleating"])
      expect(skillProblem(ok)).toBeUndefined();
  });

  it("refuses numbers, contact details, sentences and blocked work", () => {
    expect(skillProblem("Call 9845012345")).toBe(P.characters);
    expect(skillProblem("tailor@gmail.com")).toBe(P.characters);
    expect(skillProblem("https://x.in")).toBe(P.characters);
    expect(skillProblem("२४ घंटे")).toBe(P.characters);
    expect(skillProblem("I stitch blouses for ladies")).toBe(P.words);
    expect(skillProblem("a")).toBe(P.length);
    expect(skillProblem("x".repeat(41))).toBe(P.length);
    expect(skillProblem("Escort service")).toBe(P.blocked);
    expect(skillProblem("call girl")).toBe(P.blocked);
    expect(skillProblem("गांजा")).toBe(P.blocked);
  });
});

describe("a card with skills", () => {
  it("may list only skills, and older cards none", () => {
    expect(BoardProfile.parse({ ...card, skills: [tailor] }).skills).toEqual([tailor]);
    expect(BoardProfile.safeParse({ ...card, trades: ["cook"] }).success).toBe(true);
    expect(MyBoardProfile.safeParse({ ...card, skills: [tailor], show_record: true }).success).toBe(true);
  });

  it("needs some work, at most five kinds in all, and no skill twice", () => {
    expect(BoardProfile.safeParse(card).success).toBe(false);
    const skills = [tailor, { text: "Garden work", lang: "en" }, { text: "मेहंदी", lang: "hi" }];
    expect(skills).toHaveLength(MAX_SKILLS);
    expect(BoardProfile.safeParse({ ...card, skills }).success).toBe(true);
    const tooMany = { ...card, trades: ["cook", "maid", "driver"], skills };
    expect(BoardProfile.safeParse(tooMany).success).toBe(false);
    expect(BoardProfile.safeParse({ ...card, skills: [tailor, { text: "TAILOR", lang: "en" }] }).success).toBe(false);
  });

  it("is refused with a skill the board may not list", () => {
    expect(BoardProfile.safeParse({ ...card, skills: [{ text: "Call 98450 12345", lang: "en" }] }).success).toBe(false);
  });

  it("is searched by a trade or by a skill's key, never both or neither", () => {
    expect(BoardQuery.safeParse({ skill: "tailor", lat: "12.9", lon: "77.6" }).success).toBe(true);
    expect(BoardQuery.safeParse({ trade: "cook", lat: "12.9", lon: "77.6" }).success).toBe(true);
    expect(BoardQuery.safeParse({ lat: "12.9", lon: "77.6" }).success).toBe(false);
    expect(BoardQuery.safeParse({ trade: "cook", skill: "tailor", lat: "12.9", lon: "77.6" }).success).toBe(false);
    // A key is normalised: the household's own words are never what is sent.
    expect(BoardQuery.safeParse({ skill: "I need a Tailor!", lat: "12.9", lon: "77.6" }).success).toBe(false);
  });
});

describe("a job for other work", () => {
  const request = { need: "Tailor", when: "tomorrow", area };

  it("carries the skill exactly when the work is other", () => {
    expect(JobRequest.safeParse({ ...request, trade: "other", skill: tailor }).success).toBe(true);
    expect(JobRequest.safeParse({ ...request, trade: "other" }).success).toBe(false);
    expect(JobRequest.safeParse({ ...request, trade: "cook", skill: tailor }).success).toBe(false);
  });

  it("agrees only when, and signs the same fields as any job", () => {
    expect(termsFit("other", { when: { day: "2026-11-03", window: "morning" } })).toBe(true);
    expect(termsFit("other", { coats: 2 })).toBe(false);
    const terms = {
      engagement: "eng_01J0000000000000000000AAAA",
      offer_id: "off_01J0000000000000000000AAAA",
      worker: "usr_01J0000000000000000000AAAA",
      consumer: "usr_01J0000000000000000000BBBB",
      trade: "other",
      scope: "Tailor; job: stitch two blouses",
      slot: "3 Nov",
      price_paise: 60000,
    };
    expect(JobTerms.safeParse(terms).success).toBe(true);
  });

  it("is recorded on the server without words or scope", () => {
    const submit = {
      engagement: "eng_01J0000000000000000000AAAA",
      counterpart: "usr_01J0000000000000000000BBBB",
      role: "provider",
      work: { trade: "other", scope: {} },
      price_paise: 60000,
      terms_hash: "a".repeat(64),
      sig: "c2ln",
    };
    expect(JobRecordSubmit.safeParse(submit).success).toBe(true);
    const withWords = { ...submit, work: { trade: "other", scope: { skill: "Tailor" } } };
    expect(JobRecordSubmit.safeParse(withWords).success).toBe(false);
    expect(JobRecordSubmit.safeParse({ ...submit, quantities: { hours: 2 } }).success).toBe(false);
  });
});
