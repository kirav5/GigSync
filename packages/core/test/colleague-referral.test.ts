import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type ReferralError, ReferralRefusal, settle, TaskKind } from "../src/index.js";
import { ColleagueRelay, linked, RAVI_CARD, SURESH_CARD, stranger } from "./colleague-phones.js";
import { electrician, fanNeed, PRIYA, phone, RAVI } from "./phones.js";

const PETS = { problem: "Fan hums but does not spin", pets: "yes" };

/** Ravi wants to see requests with pets first and turns Priya's down; Suresh is his linked colleague. */
async function declined() {
  const relay = new ColleagueRelay();
  const ravi = await phone(relay, RAVI, { worker: { ...electrician(), ask_me: ["pets"] } });
  const suresh = await phone(relay, { ...RAVI, name: "Suresh" }, { worker: electrician(), autoConfirm: true });
  const priya = await phone(relay, PRIYA, { autoConfirm: true });
  const all = [priya.device, ravi.device, suresh.device];
  await linked(suresh, SURESH_CARD, ravi, RAVI_CARD);
  const [job] = await priya.device.request(fanNeed(65000, PETS), [ravi.user]);
  const id = job?.engagement.id as EngagementId;
  await settle(all);
  expect((await ravi.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.approveRequest]);
  await ravi.device.declineRequest(id);
  await settle(all);
  return { relay, ravi, suresh, priya, all, id };
}

const refusal = (reason: ReferralRefusal) => expect.objectContaining({ reason }) as ReferralError;

describe("passing on a declined request", () => {
  it("the worker suggests a colleague, and the household asks them the same need", async () => {
    const { ravi, suresh, priya, all, id } = await declined();
    const sent = await ravi.device.colleagues.suggest(id, suresh.user);
    expect(sent.referred).toBe(suresh.user);
    expect(sent.engagement.status).toBe("declined");
    await settle(all);

    const got = await priya.device.job(id);
    expect(got.engagement.status).toBe("declined");
    expect(got.referral).toMatchObject({ colleague: suresh.user, card: SURESH_CARD });

    const [asked] = await priya.device.colleagues.askReferred(id);
    expect(asked?.engagement).toMatchObject({ counterpart: suresh.user, group: got.engagement.group });
    expect(asked?.request).toMatchObject({ trade: "electrician", need: got.request.need, details: PETS });
    const again = await priya.device.colleagues.askReferred(id);
    expect(again.map((r) => r.engagement.id)).toEqual([asked?.engagement.id]);

    await settle(all);
    const deal = await priya.device.job(asked?.engagement.id as EngagementId);
    expect(deal.engagement.status).toBe("agreed");
    expect(deal.mine?.terms.price_paise).toBeLessThanOrEqual(65000);
    expect((await suresh.device.job(deal.engagement.id)).engagement.role).toBe("provider");
  });

  it("refuses a request that was not declined, a colleague not linked, and a job with no suggestion", async () => {
    const { ravi, suresh, priya, all, id } = await declined();
    const [open] = await priya.device.request(fanNeed(65000, { problem: "dead" }), [suresh.user]);
    await settle(all);
    const openId = open?.engagement.id as EngagementId;
    await expect(suresh.device.colleagues.suggest(openId, ravi.user)).rejects.toEqual(
      refusal(ReferralRefusal.notDeclined),
    );
    await expect(priya.device.colleagues.suggest(id, suresh.user)).rejects.toEqual(
      refusal(ReferralRefusal.notDeclined),
    );
    await expect(ravi.device.colleagues.suggest(id, priya.user)).rejects.toEqual(refusal(ReferralRefusal.notLinked));
    await expect(priya.device.colleagues.askReferred(id)).rejects.toEqual(refusal(ReferralRefusal.noReferral));
    expect((await ravi.device.job(id)).referred).toBeUndefined();
  });

  it("does not suggest anyone to a household whose GigSync is too old", async () => {
    const { relay, ravi, suresh, priya, id } = await declined();
    relay.outdated(priya.user);
    const before = relay.stored.length;
    await expect(ravi.device.colleagues.suggest(id, suresh.user)).rejects.toEqual(refusal(ReferralRefusal.tooOld));
    await ravi.device.sync();
    expect(relay.stored.length).toBe(before);
    expect((await ravi.device.job(id)).referred).toBeUndefined();
  });

  it("the household keeps a suggestion only from the worker who declined", async () => {
    const { relay, priya, all, id } = await declined();
    const x = await stranger(relay);
    await x.send(priya.user, id, "referral", { colleague: x.user, card: { ...SURESH_CARD, name: "X" } });
    await settle(all);
    expect((await priya.device.job(id)).referral).toBeUndefined();
  });
});
