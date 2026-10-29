import type { EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { DeviceError, settle } from "../src/index.js";
import {
  ASHA,
  cook,
  cookNeed,
  electrician,
  fanNeed,
  MemoryRelay,
  phone,
  RAVI,
  RAVI_HOME,
  RAVI_PAYEE,
} from "./phones.js";

describe("a worker hires a worker", () => {
  it("Asha, a cook, hires Ravi for her own wiring while a household hires her, end to end", async () => {
    const relay = new MemoryRelay();
    const asha = await phone(
      relay,
      { ...ASHA, address: "7, 2nd Main, Koramangala" },
      { worker: cook(), autoConfirm: true },
    );
    const ravi = await phone(relay, RAVI, { worker: electrician(), autoConfirm: true, payee: RAVI_PAYEE });
    const home = await phone(relay, RAVI_HOME, { autoConfirm: true });
    const all = [asha.device, ravi.device, home.device];

    const [hired] = await asha.device.request(fanNeed(65000, { problem: "dead" }), [ravi.user]);
    const [cooking] = await home.device.request(cookNeed(900000, { people: "3", meals: "2", pets: "no" }), [asha.user]);
    const id = hired?.engagement.id as EngagementId;
    await settle(all);

    const onAsha = await asha.device.job(id);
    const onRavi = await ravi.device.job(id);
    expect([onAsha.engagement.role, onRavi.engagement.role]).toEqual(["requester", "provider"]);
    expect([onAsha.engagement.status, onRavi.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(onAsha.contact).toEqual(RAVI);
    expect(onRavi.contact?.address).toBe("7, 2nd Main, Koramangala");
    // Her own work goes on as usual: she is the worker on the household's job.
    const job = await asha.device.job(cooking?.engagement.id as EngagementId);
    expect([job.engagement.role, job.engagement.status]).toEqual(["provider", "agreed"]);
    // Her work site went to the helper she hired, never to the household she works for.
    const onHome = await home.device.job(cooking?.engagement.id as EngagementId);
    expect(onHome.contact?.name).toBe(ASHA.name);
    expect(onHome.contact?.address).toBeUndefined();

    await ravi.device.deliver(id, "Wiring fixed");
    const asked = await ravi.device.requestPayment(id, "Wiring");
    await settle(all);
    // She pays on the job she hired for; she cannot ask money on it even though her phone is a worker's.
    await expect(asha.device.requestPayment(id, "no")).rejects.toThrow(DeviceError);
    await expect(asha.device.recordCash(id)).rejects.toThrow(DeviceError);
    await asha.device.markPaid(asked.id, "412345678901");
    await settle(all);
    await ravi.device.confirmPayment(asked.id);
    await settle(all);
    expect((await asha.device.payments.get(asked.id))?.status).toBe("confirmed");
    expect((await asha.device.payments.get(asked.id))?.payer).toBe(asha.user);
    await asha.device.review(id, { stars: 5 });
    await settle(all);
    expect((await ravi.device.job(id)).review?.stars).toBe(5);
  });

  it("a phone cannot hire its own owner", async () => {
    const relay = new MemoryRelay();
    const ravi = await phone(relay, RAVI, { worker: electrician() });
    await expect(ravi.device.request(fanNeed(), [ravi.user])).rejects.toThrow(DeviceError);
  });
});
