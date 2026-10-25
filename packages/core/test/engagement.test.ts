import { describe, expect, it } from "vitest";
import { allowedKinds, apply, isOpen, newEngagement, TransitionError } from "../src/index.js";

const now = new Date("2026-10-21T10:00:00+05:30");
const start = () =>
  newEngagement(
    {
      role: "requester",
      counterpart: "usr_01J0000000000000000000AAAA",
      brief: { text: "free friday?", topic: "availability", shared: {} },
    },
    now,
  );

describe("engagement machine", () => {
  it("creates a draft whose group is itself", () => {
    const e = start();
    expect(e.status).toBe("draft");
    expect(e.group).toBe(e.id);
    expect(isOpen(e)).toBe(true);
  });
  it("walks a job to closed and refuses further moves", () => {
    let e = start();
    for (const k of ["request", "quote", "agree", "agree", "update", "delivery", "review"] as const)
      e = apply(e, k, now);
    expect(e.status).toBe("closed");
    expect(isOpen(e)).toBe(false);
    expect(() => apply(e, "update", now)).toThrow(TransitionError);
  });
  it("offers only the actions this side may take now", () => {
    const e = apply(start(), "request", now);
    expect(allowedKinds(e)).toEqual(["clarify", "response", "cancel"]);
    const provider = { ...e, role: "provider" as const };
    expect(allowedKinds(provider)).toEqual(["clarify", "response", "quote", "cancel"]);
  });
});
