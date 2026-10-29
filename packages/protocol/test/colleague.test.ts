import { describe, expect, it } from "vitest";
import { ColleagueLink, inviteText, LinkStep, parseInvite } from "../src/colleague.js";

const INVITE = { u: "usr_01M6293248NT6TX9T5GJZ6ZW3D", c: "AAAAAAAAAAAAAAAAAAAAAA", n: "Meena K" };

describe("colleague invite", () => {
  it("round-trips through the QR text", () => {
    expect(parseInvite(inviteText(INVITE))).toEqual(INVITE);
  });

  it("refuses text that is not a GigSync colleague code", () => {
    expect(parseInvite("upi://pay?pa=x@ybl")).toBeUndefined();
    expect(parseInvite(`${inviteText(INVITE)}`.replace("c=AAAA", "c=AA"))).toBeUndefined();
  });
});

describe("colleague link body", () => {
  const card = { name: "Meena", trades: ["cook" as const], languages: ["hi" as const] };

  it("needs a code and a card to ask, and a card to answer ok", () => {
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ask, card }).success).toBe(false);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ask, code: INVITE.c, card }).success).toBe(true);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.ok }).success).toBe(false);
    expect(ColleagueLink.safeParse({ step: LinkStep.enum.end }).success).toBe(true);
  });
});
