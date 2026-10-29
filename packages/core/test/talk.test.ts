import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { agentTalk, settle, TalkKind } from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const kinds = (steps: { kind: string }[]) => steps.map((s) => s.kind);

describe("agentTalk", () => {
  it("tells the same story on both phones: request, question, answer, offers, agreement, signatures, contacts", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, PRIYA, { autoConfirm: true });
    const ravi = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true });
    // No problem detail up front, so Ravi's agent asks for it.
    const [asked] = await home.device.request(fanNeed(65000), [ravi.user]);
    const id = asked?.engagement.id as EngagementId;
    await settle([home.device, ravi.device]);
    await home.device.answer(id, { problem: "hums but does not spin" });
    await settle([home.device, ravi.device]);

    const onHome = agentTalk(await home.device.job(id));
    const onRavi = agentTalk(await ravi.device.job(id));
    expect(kinds(onHome)).toEqual(kinds(onRavi));
    expect(kinds(onHome).slice(0, 3)).toEqual([TalkKind.request, TalkKind.questions, TalkKind.answers]);
    expect(kinds(onHome).slice(-4)).toEqual([TalkKind.agreed, TalkKind.signed, TalkKind.signed, TalkKind.contacts]);
    expect(onHome.find((s) => s.kind === TalkKind.questions)).toMatchObject({ by: "provider", keys: ["problem"] });
    expect(onRavi.find((s) => s.kind === TalkKind.answers)).toMatchObject({
      by: "requester",
      answers: [["problem", "hums but does not spin"]],
    });
    const offers = onHome.filter((s) => s.kind === TalkKind.offer);
    expect(offers.length).toBeGreaterThan(0);
    // Agreed inside both limits: never above her budget, never below his floor.
    const agreed = onHome.find((s) => s.kind === TalkKind.agreed);
    expect(agreed).toBeDefined();
    if (agreed?.kind === TalkKind.agreed) {
      expect(agreed.price_paise).toBeLessThanOrEqual(65000);
      expect(agreed.price_paise).toBeGreaterThanOrEqual(55000);
    }
  });

  it("asks nothing when the household gave the answer up front", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, PRIYA, { autoConfirm: true });
    const ravi = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true });
    const [asked] = await home.device.request(fanNeed(65000, { problem: "dead" }), [ravi.user]);
    await settle([home.device, ravi.device]);
    const steps = agentTalk(await ravi.device.job(asked?.engagement.id as EngagementId));
    expect(kinds(steps)).not.toContain(TalkKind.questions);
    expect(kinds(steps)[0]).toBe(TalkKind.request);
  });
});
