import { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type Advice, type JobRecord, ReasonKind, settle, TaskKind, type WorkerRules } from "../src/index.js";
import { ASHA, BENGALURU_RATES, cook, cookNeed, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

/** Asha with the Bengaluru pack, asking to see any household with pets first. */
const ashaRules = (askMe = true): WorkerRules => ({
  ...cook(),
  rates: BENGALURU_RATES,
  ...(askMe ? { ask_me: ["pets" as const] } : {}),
});
const answers = { people: "3", meals: "breakfast, dinner", pets: "yes" };
/** Whole ₹10s up, after whole paise, as advice.ts rounds. */
const roundUp = (paise: number) => Math.ceil(Math.round(paise) / 1000) * 1000;
/** The opening the job's drawn strategy puts between `from` and `to` (ADR 0033). */
const drawnOpening = (r: JobRecord, from: number, to: number) =>
  roundUp(from + (to - from) * (r.strategy?.opening ?? 1));

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
    // Limit: her floor plus 15%; opening: drawn for this job between the usual price (the band's middle, plus 15%)
    // and the band's high plus 15%.
    expect(advice.mandate.limit_paise).toBe(920000);
    const planned = await asha.device.job(id);
    expect(planned.strategy).toBeDefined();
    expect(advice.mandate.opening_paise).toBe(drawnOpening(planned, 850000 * 1.15, 1093000));
    expect(advice.mandate.opening_paise).toBeGreaterThanOrEqual(977500);
    expect(advice.mandate.opening_paise).toBeLessThanOrEqual(1093000);
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
    expect(price).toBeGreaterThanOrEqual(920000); // Asha's floor, scaled for the dog
    expect(price).toBeLessThanOrEqual(950000); // Ravi's private limit
    // Every offer Asha's agent made followed her plan's curve: it opened at the plan and never went below the limit.
    const hers = onAsha.offers.filter((o) => o.by === "provider").map((o) => o.offer.price_paise);
    expect(hers[0]).toBe(advice.mandate.opening_paise);
    for (const p of hers) expect(p).toBeGreaterThanOrEqual(920000);
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
    expect(onAsha.advice?.mandate.limit_paise).toBe(800000);
    expect(onAsha.advice?.mandate.opening_paise).toBe(drawnOpening(onAsha, 850000, 950000));
    expect(onAsha.offers[0]?.offer.price_paise).toBe(onAsha.advice?.mandate.opening_paise);
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
    const again = await asha.device.job(second?.engagement.id as never);
    expect(again.advice?.reasons).toContainEqual({ kind: ReasonKind.history, median_paise: paid, count: 1 });
    // Opening: drawn between what she was paid and 10% more, never above the band's high.
    const opening = drawnOpening(again, Math.min(950000, paid), Math.min(950000, paid * 1.1));
    expect(again.advice?.mandate.opening_paise).toBe(opening);
  });
});
