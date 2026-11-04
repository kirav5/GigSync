import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { settle, TaskKind } from "../src/index.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const status = async (d: { job(id: never): Promise<{ engagement: { status: string } }> }, id: string) =>
  (await d.job(id as never)).engagement.status;

describe("a job between two phones", () => {
  it("asks once, negotiates inside both limits, needs both owners to sign, then releases contacts", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician() });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request(fanNeed(), [worker.user]);
    const id = job?.engagement.id as never;

    await settle([consumer.device, worker.device]);
    // The worker asked what is wrong; the consumer's agent had no answer, so it asked its owner.
    const [ask] = await consumer.device.tasks();
    expect(ask?.kind).toBe(TaskKind.answerQuestions);
    await consumer.device.answer(id, { problem: "Fan hums but does not spin" });
    await settle([consumer.device, worker.device]);

    // The agents met in the middle; one owner is asked to sign, and nobody has a contact yet.
    const firstAsk = [...(await consumer.device.tasks()), ...(await worker.device.tasks())];
    expect(firstAsk.map((t) => t.kind)).toEqual([TaskKind.confirmDeal]);
    expect((await consumer.device.job(id)).contact).toBeUndefined();
    const first = firstAsk[0]?.engagement === id && (await consumer.device.tasks()).length ? consumer : worker;
    const second = first === consumer ? worker : consumer;
    await first.device.confirmDeal(id);
    await settle([consumer.device, worker.device]);
    expect(await status(first.device, id)).toBe("confirming");
    expect((await second.device.job(id)).contact).toBeUndefined();

    await second.device.confirmDeal(id);
    await settle([consumer.device, worker.device]);
    const c = await consumer.device.job(id);
    const w = await worker.device.job(id);
    expect([c.engagement.status, w.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(c.mine?.terms_hash).toBe(w.mine?.terms_hash);
    expect(c.mine?.terms.price_paise).toBeGreaterThanOrEqual(55000);
    expect(c.mine?.terms.price_paise).toBeLessThanOrEqual(65000);
    expect(c.contact).toEqual(RAVI);
    expect(w.contact).toEqual(PRIYA);
    // The relay only ever held ciphertext.
    expect(JSON.stringify(relay.stored)).not.toContain("5th Cross");
    expect(JSON.stringify(relay.stored)).not.toContain("9800000101");
  });

  it("hands a budget below the worker's minimum to the worker after three offers, who ends it: no deal", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician(60000) });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request(fanNeed(45000, { problem: "dead" }), [worker.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([consumer.device, worker.device]);
    // Three offers each and no meeting: the agents stop and the worker's owner decides (ADR 0053 §4).
    expect((await worker.device.job(id)).offers_made).toBe(3);
    expect((await worker.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.takeOver]);
    await worker.device.talks.end(id);
    await settle([consumer.device, worker.device]);
    const c = await consumer.device.job(id);
    expect(c.engagement.status).toBe("cancelled");
    expect(c.cancel?.reason).toBe("no_deal");
    expect(c.contact).toBeUndefined();
    expect([...(await consumer.device.tasks()), ...(await worker.device.tasks())]).toEqual([]);
  });

  it("declines a trade the worker does not do", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician() });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request({ ...fanNeed(), trade: "plumber" }, [worker.user]);
    await settle([consumer.device, worker.device]);
    const c = await consumer.device.job(job?.engagement.id as never);
    expect(c.engagement.status).toBe("declined");
    expect(c.cancel?.reason).toBe("no_match");
  });

  it("an owner declining the deal cancels it on both phones with no contact released", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true });
    const consumer = await phone(relay, PRIYA);
    const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
    const id = job?.engagement.id as never;
    await settle([consumer.device, worker.device]);
    const [confirm] = await consumer.device.tasks();
    expect(confirm?.kind).toBe(TaskKind.confirmDeal);
    await consumer.device.declineDeal(id);
    await settle([consumer.device, worker.device]);
    expect([await status(consumer.device, id), await status(worker.device, id)]).toEqual(["cancelled", "cancelled"]);
    expect((await worker.device.job(id)).contact).toBeUndefined();
  });

  it("asks several workers at once and cancels the rest once one is signed", async () => {
    const relay = new MemoryRelay();
    const pricey = await phone(relay, RAVI, { worker: electrician(62000, 80000), autoConfirm: true });
    const cheap = await phone(
      relay,
      { ...RAVI, name: "Suresh" },
      { worker: electrician(50000, 60000), autoConfirm: true },
    );
    const consumer = await phone(relay, PRIYA, { autoConfirm: true });
    const [a, b] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [pricey.user, cheap.user]);
    await settle([consumer.device, pricey.device, cheap.device]);
    const jobs = await consumer.device.jobs();
    expect(jobs.filter((j) => j.engagement.status === "agreed")).toHaveLength(1);
    expect(jobs.filter((j) => j.cancel?.reason === "taken")).toHaveLength(1);
    const won = jobs.find((j) => j.engagement.status === "agreed");
    // Whichever deal closes first inside the budget wins; the other is released.
    expect(won?.mine?.terms.price_paise).toBeLessThanOrEqual(65000);
    const lost = won?.engagement.id === a?.engagement.id ? cheap : pricey;
    const lostId = (won?.engagement.id === a?.engagement.id ? b : a)?.engagement.id as never;
    expect(await status(lost.device, lostId)).toBe("cancelled");
    expect((await lost.device.job(lostId)).contact).toBeUndefined();
  });

  it("drops an envelope a third party sends into someone else's job", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician() });
    const consumer = await phone(relay, PRIYA);
    const stranger = await phone(relay, { name: "X", phone: "+919800000999" }, { worker: electrician() });
    const [job] = await consumer.device.request(fanNeed(65000, { problem: "dead" }), [worker.user]);
    await settle([consumer.device, worker.device]);
    await expect(stranger.device.cancelJob(job?.engagement.id as never)).rejects.toThrow();
    expect(await status(consumer.device, job?.engagement.id as string)).not.toBe("cancelled");
  });
});
