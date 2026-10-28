import { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type Advice, ReasonKind, settle, TaskKind, type WorkerRules } from "../src/index.js";
import { ASHA, BENGALURU_RATES, cook, cookNeed, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

/** Asha with the Bengaluru pack, asking to see any household with pets first. */
const ashaRules = (askMe = true): WorkerRules => ({
  ...cook(),
  rates: BENGALURU_RATES,
  ...(askMe ? { ask_me: ["pets" as const] } : {}),
});
const answers = { people: "3", meals: "breakfast, dinner", pets: "yes" };

async function pair(rules: WorkerRules) {
  const relay = new MemoryRelay();
  const asha = await phone(relay, ASHA, { worker: rules, lang: Lang.enum.hi });
  const ravi = await phone(relay, RAVI_HOME, { lang: Lang.enum.kn });
  const talk = () => settle([ravi.device, asha.device]);
  /** Each owner signs when their phone asks them to: the one whose agent accepted first, then the other. */
  const sign = async (id: never) => {
    for (let turn = 0; turn < 2; turn++) {
      for (const p of [asha, ravi]) if ((await p.device.tasks()).length) await p.device.confirmDeal(id);
      await talk();
    }
  };
  return { relay, asha, ravi, talk, sign };
}

describe("the worker's agent prices each job from the city's rates and the worker's rules", () => {
  it("asks, stops for the worker because of the dog, plans from the band plus 15%, then the agents agree", async () => {
    const { asha, ravi, talk, sign } = await pair(ashaRules());
    const [job] = await ravi.device.request(cookNeed(950000), [asha.user]);
    const id = job?.engagement.id as never;
    await talk();
    await ravi.device.answer(id, answers);
    await talk();

    // Pets is on Asha's "show me first" list: her agent planned the job but quoted nothing yet.
    const [show] = await asha.device.tasks();
    expect(show?.kind).toBe(TaskKind.approveRequest);
    const { flagged, advice } = (show?.detail ?? {}) as { flagged: string[]; advice: Advice };
    expect(flagged).toEqual(["pets"]);
    expect(advice.mandate).toEqual({ opening_paise: 1093000, limit_paise: 863000 });
    expect(advice.reasons).toContainEqual({ kind: ReasonKind.scope, key: "pets", percent: 15 });
    expect((await asha.device.job(id)).offers).toEqual([]);

    await asha.device.approveRequest(id);
    await talk();
    const deal = [...(await asha.device.tasks()), ...(await ravi.device.tasks())];
    expect(deal.map((t) => t.kind)).toEqual([TaskKind.confirmDeal]);
    await sign(id);

    const onAsha = await asha.device.job(id);
    const onRavi = await ravi.device.job(id);
    expect([onAsha.engagement.status, onRavi.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(onAsha.mine?.terms_hash).toBe(onRavi.mine?.terms_hash);
    const price = onAsha.mine?.terms.price_paise as number;
    expect(price).toBeGreaterThanOrEqual(863000); // Asha's scoped limit
    expect(price).toBeLessThanOrEqual(950000); // Ravi's private limit
    // Every offer Asha's agent made followed her plan's curve: it opened at the plan and never went below the limit.
    const hers = onAsha.offers.filter((o) => o.by === "provider").map((o) => o.offer.price_paise);
    expect(hers[0]).toBe(1093000);
    for (const p of hers) expect(p).toBeGreaterThanOrEqual(863000);
  });

  it("the worker declines: declined on both phones, no offer made, nothing shared", async () => {
    const { asha, ravi, talk } = await pair(ashaRules());
    const [job] = await ravi.device.request(cookNeed(950000, answers), [asha.user]);
    const id = job?.engagement.id as never;
    await talk();
    await asha.device.declineRequest(id);
    await talk();
    const onRavi = await ravi.device.job(id);
    // A cancel before any offer is a decline in the engagement machine.
    expect([onRavi.engagement.status, (await asha.device.job(id)).engagement.status]).toEqual(["declined", "declined"]);
    expect(onRavi.cancel?.reason).toBe("declined_by_owner");
    expect(onRavi.offers).toEqual([]);
    expect(onRavi.contact).toBeUndefined();
    expect([...(await asha.device.tasks()), ...(await ravi.device.tasks())]).toEqual([]);
  });

  it("with no flagged detail the agent quotes at once from the band", async () => {
    const { asha, ravi, talk } = await pair(ashaRules());
    const [job] = await ravi.device.request(cookNeed(950000, { ...answers, pets: "no" }), [asha.user]);
    await talk();
    const onAsha = await asha.device.job(job?.engagement.id as never);
    expect(onAsha.advice?.mandate).toEqual({ opening_paise: 950000, limit_paise: 800000 });
    expect(onAsha.offers[0]?.offer.price_paise).toBe(950000);
  });

  it("a second job's plan opens from what the first one actually paid", async () => {
    const { asha, ravi, talk, sign } = await pair(ashaRules(false));
    const noPets = { ...answers, pets: "no" };
    const [first] = await ravi.device.request(cookNeed(880000, noPets), [asha.user]);
    await talk();
    await sign(first?.engagement.id as never);
    const paid = (await asha.device.job(first?.engagement.id as never)).mine?.terms.price_paise as number;
    expect(paid).toBeGreaterThanOrEqual(800000);

    const [second] = await ravi.device.request(cookNeed(950000, noPets), [asha.user]);
    await talk();
    const advice = (await asha.device.job(second?.engagement.id as never)).advice;
    expect(advice?.reasons).toContainEqual({ kind: ReasonKind.history, median_paise: paid, count: 1 });
    expect(advice?.mandate.opening_paise).toBe(Math.min(950000, Math.ceil((paid * 1.1) / 1000) * 1000));
  });
});
