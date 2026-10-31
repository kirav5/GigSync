import { describe, expect, it } from "vitest";
import { ColleagueLink, LinkStep } from "../src/colleague.js";

/** A code an older build's QR carried: its `ask` must still parse, so it can be dropped rather than stall the inbox. */
const CODE = "AAAAAAAAAAAAAAAAAAAAAA";

describe("colleague link body", () => {
  const card = { name: "Meena", trades: ["cook" as const], languages: ["hi" as const] };

  it("needs a code and a card to ask, and a card to answer ok", () => {
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ask, card }).success).toBe(false);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ask, code: CODE, card }).success).toBe(true);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ok }).success).toBe(false);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.end }).success).toBe(true);
  });
});
