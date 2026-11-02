import { Arrangement, type EngagementId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type NewNeed, settle, type WorkerRules } from "../src/index.js";
import { BENGALURU, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

/** The worker's agent and a maid's arrangements (ADR 0046); the address released after signing (ADR 0045). */

const A = Arrangement.enum;
const SITE = "Flat 4B, 12th Main, Banashankari 2nd Stage, Bengaluru 560070";

/** Lakshmi takes hourly work at ₹180 (₹135 at least) and monthly at ₹8,000 (₹6,000 at least). */
const lakshmi = (arrangements = true): WorkerRules => ({
  trades: ["maid"],
  rate: { opening_paise: 800_000, limit_paise: 600_000 },
  base: BENGALURU,
  radius_km: 10,
  ...(arrangements
    ? {
        arrangements: [
          { arrangement: A.hourly, rate: { opening_paise: 18_000, limit_paise: 13_500 } },
          { arrangement: A.monthly, rate: { opening_paise: 800_000, limit_paise: 600_000 } },
        ],
      }
    : {}),
});

const hours = (budget: number, arrangement: Arrangement = A.hourly): NewNeed => ({
  trade: "maid",
  need: "Clean the flat after a party",
  when: "Saturday",
  area: { lat: 12.97, lon: 77.65 },
  locality: "Indiranagar",
  site: SITE,
  details: { arrangement, rooms: "2", pets: "no" },
  budget: { opening_paise: Math.round(budget * 0.7), limit_paise: budget },
});

async function pair(rules: WorkerRules) {
  const relay = new MemoryRelay();
  const worker = await phone(relay, RAVI, { worker: rules, autoConfirm: true });
  const household = await phone(relay, PRIYA, { autoConfirm: true });
  return { relay, worker, household, talk: () => settle([household.device, worker.device]) };
}

describe("a maid asked by the hour", () => {
  it("is quoted an hour's price from her hourly rate, never her monthly one, and the deal is per hour", async () => {
    const { relay, worker, household, talk } = await pair(lakshmi());
    const [job] = await household.device.request(hours(20_000), [worker.user]);
    const id = job?.engagement.id as EngagementId;
    await talk();
    for (const t of await household.device.tasks()) await household.device.confirmDeal(t.engagement);
    for (const t of await worker.device.tasks()) await worker.device.confirmDeal(t.engagement);
    await talk();
    const mine = await worker.device.job(id);
    const price = mine.mine?.terms.price_paise ?? 0;
    expect(price).toBeGreaterThanOrEqual(13_500);
    expect(price).toBeLessThanOrEqual(20_000);
    // The signed scope names the arrangement, so both phones signed a price per hour.
    expect(mine.mine?.terms.scope).toContain(`arrangement: ${A.hourly}`);
    // The worker gets the address of the place this need is for, only now, and the relay never held it in clear.
    expect(mine.contact?.address).toBe(SITE);
    expect(JSON.stringify(relay.stored)).not.toContain("Banashankari");
    // Before signing, the request carried the locality and a coarse point only.
    expect(mine.request.locality).toBe("Indiranagar");
    expect(mine.request.area).toEqual({ lat: 12.97, lon: 77.65 });
  });

  it("is declined by a maid who takes monthly work only", async () => {
    const { worker, household, talk } = await pair(lakshmi(false));
    const [job] = await household.device.request(hours(20_000), [worker.user]);
    await talk();
    const c = await household.device.job(job?.engagement.id as EngagementId);
    expect(c.engagement.status).toBe("declined");
    expect(c.cancel?.reason).toBe("no_match");
  });

  it("is still taken monthly by that maid", async () => {
    const { worker, household, talk } = await pair(lakshmi(false));
    const [job] = await household.device.request(hours(900_000, A.monthly), [worker.user]);
    await talk();
    const c = await household.device.job(job?.engagement.id as EngagementId);
    expect(c.cancel).toBeUndefined();
  });
});
