import {
  type BoardProfile,
  type ContactCard,
  OFFERS_PER_WORKER_DAY,
  QrRole,
  TERMS_PROTOCOL,
  WORK_OFFER_PROTOCOL,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { boardWorkerOf, MAX_OPEN_OFFERS, QrError, QrProblem, type WorkerRules } from "../src/index.js";
import { MentorStore } from "../src/mentor/store.js";
import { TestClock } from "./mentor-phones.js";
import { BENGALURU, electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";
import { FakeQrServer, qrApiFor } from "./qr-phones.js";

const DAY_MS = 24 * 60 * 60_000;
const ravisCard: BoardProfile = {
  display_name: "Ravi",
  trades: ["electrician"],
  area: BENGALURU,
  area_name: "Indiranagar",
  rate_paise: 70000,
  languages: ["kn"],
  about: "",
};

/** One phone on the offers protocol (unless `protocol` says older), with the fake QR routes. */
async function qrPhone(
  w: { relay: MemoryRelay; server: FakeQrServer; clock: TestClock },
  contact: ContactCard,
  opts: { worker?: WorkerRules; protocol?: number } = {},
) {
  const { api, bind } = qrApiFor(w.server);
  const p = await phone(w.relay, contact, { protocol: WORK_OFFER_PROTOCOL, clock: w.clock, qrApi: api, ...opts });
  bind(p.user);
  return { ...p, api };
}

function world() {
  return { relay: new MemoryRelay(), server: new FakeQrServer(), clock: new TestClock() };
}

/** Ravi, a listed electrician, and Priya's household with a live QR. */
async function pair(homeProtocol = WORK_OFFER_PROTOCOL) {
  const w = world();
  const ravi = await qrPhone(w, RAVI, { worker: electrician() });
  const priya = await qrPhone(w, PRIYA, { protocol: homeProtocol });
  const { code } = await priya.api.myQr({ role: QrRole.enum.household, first_name: "Priya" });
  return { w, ravi, priya, code };
}

const problemOf = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (err: unknown) => (err instanceof QrError ? err.problem : err),
  );

describe("offers to work through a personal QR", () => {
  it("reaches the household's Today; asking sends the usual request to that worker alone", async () => {
    const { ravi, priya, code } = await pair();
    const scanned = await ravi.api.lookupQr(code);
    expect(scanned).toEqual({ role: QrRole.enum.household, user: priya.user, first_name: "Priya" });
    await ravi.device.offers.offer(code, scanned.user, ravisCard);
    expect(await ravi.device.offers.offeredToday(priya.user)).toBe(true);
    await ravi.device.sync();

    await priya.device.sync();
    const [offer] = await priya.device.offers.open();
    expect(offer).toMatchObject({ worker: ravi.user, card: ravisCard });
    if (!offer) throw new Error("no offer");
    // Nothing reached Ravi: the household has not asked yet.
    expect(await ravi.device.sync()).toMatchObject({ received: 0 });

    const asked = await priya.device.offers.ask(offer.channel);
    expect(await priya.device.offers.open()).toEqual([]);
    const chosen = boardWorkerOf(asked.worker, asked.card, fanNeed().area);
    expect(chosen.distance_km).toBeLessThan(1);
    await priya.device.request(fanNeed(), [chosen.user]);
    await priya.device.sync();
    await ravi.device.sync();
    const [job] = await ravi.device.jobs();
    expect(job?.engagement.counterpart).toBe(priya.user);
  });

  it("goes nowhere when a household phone is too old to read it, and takes no offer from the server", async () => {
    const { ravi, priya, code } = await pair(TERMS_PROTOCOL);
    expect(await problemOf(ravi.device.offers.offer(code, priya.user, ravisCard))).toBe(QrProblem.too_old);
    expect(await ravi.device.offers.offeredToday(priya.user)).toBe(false);
  });

  it("drops offers from someone the household blocked, and refuses offering to someone the worker blocked", async () => {
    const { w, ravi, priya, code } = await pair();
    await new MentorStore(priya.storage).block(ravi.user, w.clock.now());
    await ravi.device.offers.offer(code, priya.user, ravisCard);
    await ravi.device.sync();
    await priya.device.sync();
    expect(await priya.device.offers.open()).toEqual([]);

    const asha = await qrPhone(w, { name: "Asha", phone: "+919800000303" }, { worker: electrician() });
    await new MentorStore(asha.storage).block(priya.user, w.clock.now());
    expect(await problemOf(asha.device.offers.offer(code, priya.user, ravisCard))).toBe(QrProblem.blocked);
  });

  it("keeps one open offer per worker, the newest, and Not now sends nothing", async () => {
    const { w, ravi, priya, code } = await pair();
    await ravi.device.offers.offer(code, priya.user, ravisCard);
    await ravi.device.sync();
    w.clock.advance(DAY_MS + 1);
    // Priya made a new QR meanwhile; Ravi scans it and offers again the next day.
    const { code: next } = await priya.api.replaceQr({ role: QrRole.enum.household, first_name: "Priya" });
    expect(await problemOf(ravi.device.offers.offer(code, priya.user, ravisCard))).toBe(QrProblem.ended);
    await ravi.device.offers.offer(next, priya.user, { ...ravisCard, rate_paise: 65000 });
    await ravi.device.sync();
    await priya.device.sync();
    const open = await priya.device.offers.open();
    expect(open.map((o) => o.card.rate_paise)).toEqual([65000]);
    const [only] = open;
    if (!only) throw new Error("no offer");
    await priya.device.offers.decline(only.channel);
    expect(await priya.device.offers.open()).toEqual([]);
    expect(await problemOf(priya.device.offers.ask(only.channel))).toBe(QrProblem.not_found);
    expect(await ravi.device.sync()).toMatchObject({ received: 0 });
  });

  it("is dropped by a worker's phone, and hidden after a week", async () => {
    const { w, ravi, priya, code } = await pair();
    const other = await qrPhone(w, { name: "Mohan", phone: "+919800000505" }, { worker: electrician() });
    const { code: lied } = await other.api.myQr({ role: QrRole.enum.household, first_name: "Mohan" });
    await ravi.device.offers.offer(lied, other.user, ravisCard);
    await ravi.device.offers.offer(code, priya.user, ravisCard);
    await ravi.device.sync();
    await Promise.all([other.device.sync(), priya.device.sync()]);
    expect(await other.device.offers.open()).toEqual([]);
    expect(await priya.device.offers.open()).toHaveLength(1);
    w.clock.advance(7 * DAY_MS);
    expect(await priya.device.offers.open()).toEqual([]);
  });

  it("stops at the day's limit on the worker's phone, and the server's refusals say why", async () => {
    const { w, ravi, priya, code } = await pair();
    await ravi.device.offers.offer(code, priya.user, ravisCard);
    expect(await problemOf(ravi.device.offers.offer(code, priya.user, ravisCard))).toBe("offered_today");
    w.clock.advance(DAY_MS + 1);
    // The phone's own count has moved on; the server still has today's offer through this code.
    expect(await problemOf(ravi.device.offers.offer(code, priya.user, ravisCard))).toBe("offered_today");
    for (let i = 1; i <= OFFERS_PER_WORKER_DAY + 1; i++) {
      const home = await qrPhone(w, { name: `Home ${i}`, phone: `+91980000${String(i).padStart(4, "0")}` });
      const { code: c } = await home.api.myQr({ role: QrRole.enum.household, first_name: `Home ${i}` });
      const offered = ravi.device.offers.offer(c, home.user, ravisCard);
      if (i <= OFFERS_PER_WORKER_DAY) await offered;
      else expect(await problemOf(offered)).toBe("worker_limit");
    }
  });

  it("keeps at most MAX_OPEN_OFFERS open offers", async () => {
    const { w, priya, code } = await pair();
    for (let i = 0; i <= MAX_OPEN_OFFERS; i++) {
      const p = await qrPhone(
        w,
        { name: `W${i}`, phone: `+91981000${String(i).padStart(4, "0")}` },
        { worker: electrician() },
      );
      await p.device.offers.offer(code, priya.user, { ...ravisCard, display_name: `W${i}` });
      await p.device.sync();
    }
    await priya.device.sync();
    expect(await priya.device.offers.open()).toHaveLength(MAX_OPEN_OFFERS);
  });
});
