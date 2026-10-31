import { describe, expect, it } from "vitest";
import { BODY, EnvelopeKind, JobProblem, PROBLEM_NOTE_MAX, SIDE_CHANNEL_KINDS } from "../src/index.js";

describe("report a problem", () => {
  it("travels beside the job, never moving it", () => {
    expect(SIDE_CHANNEL_KINDS.has(EnvelopeKind.enum.problem)).toBe(true);
    expect(BODY.problem).toBe(JobProblem);
  });

  it("takes a reason from the list and optional words when reported, only the state when resolved", () => {
    expect(JobProblem.safeParse({ state: "open", reason: "not_paid" }).success).toBe(true);
    expect(JobProblem.parse({ state: "open", reason: "damage", text: "Broke a cup" })).toEqual({
      state: "open",
      reason: "damage",
      text: "Broke a cup",
      lang: "en",
    });
    expect(JobProblem.safeParse({ state: "resolved" }).success).toBe(true);
  });

  it("refuses a reason outside the list, no reason, and long words", () => {
    expect(JobProblem.safeParse({ state: "open", reason: "late" }).success).toBe(false);
    expect(JobProblem.safeParse({ state: "open" }).success).toBe(false);
    const long = "x".repeat(PROBLEM_NOTE_MAX + 1);
    expect(JobProblem.safeParse({ state: "open", reason: "other", text: long }).success).toBe(false);
    expect(JobProblem.safeParse({ state: "closed" }).success).toBe(false);
  });
});
