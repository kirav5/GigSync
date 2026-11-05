import { passbook, TaskKind } from "@gigsync/core";
import type { EngagementId } from "@gigsync/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { near, need, newCentre, type Person, person, talk, worker } from "./world.js";

const centre = newCentre();
const listed: Person[] = [];
let anil: Person; // electrician, 1 km, signs deals himself
let babu: Person; // electrician, 2 km, lets his agent sign
let chetan: Person; // electrician, 4 km, pricier
let dinesh: Person; // electrician, 40 km away, works within 10 km
let esha: Person; // plumber
let gauri: Person; // maid
let imran: Person; // AC technician

beforeAll(async () => {
  const list = async (...a: Parameters<typeof worker>) => {
    const w = await worker(...a);
    listed.push(w);
    return w;
  };
  anil = await list("Anil", ["electrician"], near(centre, 1), { rate: 70000, min: 55000 }, { autoConfirm: false });
  babu = await list("Babu", ["electrician"], near(centre, 0, 2), { rate: 65000, min: 52000 }, { autoConfirm: true });
  chetan = await list("Chetan", ["electrician"], near(centre, -4), { rate: 80000, min: 62000 }, { autoConfirm: true });
  dinesh = await list("Dinesh", ["electrician"], near(centre, 40), { rate: 50000, min: 40000 }, { autoConfirm: true });
  esha = await list("Esha", ["plumber"], near(centre, 1.5), { rate: 60000, min: 45000 }, { autoConfirm: true });
  gauri = await list("Gauri", ["maid"], near(centre, 0.5), { rate: 40000, min: 35000 }, { autoConfirm: true });
  imran = await list("Imran", ["ac_technician"], near(centre, 2), { rate: 90000, min: 70000 }, { autoConfirm: true });
});

afterAll(async () => {
  await Promise.all(listed.map((w) => w.api.removeProfile()));
});

const status = async (p: Person, id: EngagementId) => (await p.device.job(id)).engagement.status;
/** This computer's offset from UTC, as a phone would use it for its week and month. */
const LOCAL_OFFSET = -new Date().getTimezoneOffset();
const passbookOf = async (w: Person) =>
  passbook(await w.device.jobs(), await w.device.payments.all(), w.session.user, new Date(), LOCAL_OFFSET);

describe("consumer and worker, end to end through the real API and Neon", () => {
  it("Priya finds the nearest electrician, answers his question, both sign, they swap contacts, he is paid and rated", async () => {
    const priya = await person("Priya", { address: "Flat 302, 3rd floor, 5th Cross" });
    const [first] = await priya.api.searchWorkers({ trade: "electrician", ...centre, radius_km: 5 });
    expect(first?.user).toBe(anil.session.user);

    const [job] = await priya.device.request(need("electrician", centre, 65000, "Ceiling fan stopped working"), [
      anil.session.user,
    ]);
    const id = job?.engagement.id as EngagementId;
    await priya.device.sync();
    // What the server holds for Anil is ciphertext: no need, no address, no phone.
    const raw = JSON.stringify(await anil.api.inbox());
    expect(raw).toContain(id);
    for (const secret of ["Ceiling fan", "5th Cross", priya.contact.phone.slice(3)]) expect(raw).not.toContain(secret);

    await talk(priya, anil);
    const [ask] = await priya.device.tasks();
    expect(ask).toMatchObject({ kind: TaskKind.answerQuestions, engagement: id });
    await priya.device.answer(id, { problem: "Fan hums but does not spin" });
    await talk(priya, anil);

    // Agents met inside both limits; both owners must sign, and no contact moves before that.
    const signer = (await priya.device.tasks()).length > 0 ? priya : anil;
    const other = signer === priya ? anil : priya;
    expect((await signer.device.tasks())[0]?.kind).toBe(TaskKind.confirmDeal);
    await signer.device.confirmDeal(id);
    await talk(priya, anil);
    expect((await other.device.tasks())[0]?.kind).toBe(TaskKind.confirmDeal);
    expect((await other.device.job(id)).contact).toBeUndefined();
    await other.device.confirmDeal(id);
    await talk(priya, anil);

    const p = await priya.device.job(id);
    const a = await anil.device.job(id);
    expect([p.engagement.status, a.engagement.status]).toEqual(["agreed", "agreed"]);
    expect(p.mine?.terms_hash).toBe(a.mine?.terms_hash);
    const price = p.mine?.terms.price_paise as number;
    expect(price).toBeGreaterThanOrEqual(55000);
    expect(price).toBeLessThanOrEqual(65000);
    expect(p.contact).toEqual(anil.contact);
    expect(a.contact).toEqual(priya.contact);

    await anil.device.update(id, "On my way, 10 minutes");
    await anil.device.deliver(id, "Capacitor replaced; fan works");
    const asked = await anil.device.requestPayment(id, "Fan repair");
    await talk(priya, anil);
    expect(await status(priya, id)).toBe("delivered");
    const link = await priya.device.upiLink(asked.id);
    expect(link).toMatch(/^upi:\/\/pay\?/);
    expect(link).toContain("pa=anil.test@okaxis");
    expect(link).toContain(`am=${(price / 100).toFixed(2)}`);

    await priya.device.markPaid(asked.id, "412345678901");
    await talk(priya, anil);
    expect((await anil.device.tasks())[0]?.kind).toBe(TaskKind.confirmPayment);
    await anil.device.confirmPayment(asked.id);
    await priya.device.review(id, { stars: 5, text: "Quick and tidy" });
    await talk(priya, anil);
    expect((await priya.device.payments.get(asked.id))?.status).toBe("confirmed");
    expect((await anil.device.job(id)).review).toEqual({ stars: 5, text: "Quick and tidy" });
    expect([await status(priya, id), await status(anil, id)]).toEqual(["closed", "closed"]);

    const book = await passbookOf(anil);
    expect(book.rows.map((r) => [r.payment.id, r.payment.status, r.payment.utr])).toEqual([
      [asked.id, "confirmed", "412345678901"],
    ]);
    expect(book.totals).toMatchObject({ week: price, waiting: 0, notAsked: 0 });
  });

  it("Rahul asks the three nearest electricians at once and ends up with exactly one", async () => {
    const rahul = await person("Rahul", { autoConfirm: true, address: "House 12, MG Road" });
    const found = await rahul.api.searchWorkers({ trade: "electrician", ...centre, radius_km: 10, limit: 3 });
    expect(found.map((w) => w.display_name)).toEqual(["Anil", "Babu", "Chetan"]);
    await rahul.device.request(
      need("electrician", centre, 64000, "Switchboard sparks", { problem: "sparks when the switch is pressed" }),
      found.map((w) => w.user),
    );
    await talk(rahul, anil, babu, chetan);
    // Anil signs his own deals: if Rahul's agent reached him first, Anil taps to sign.
    for (const t of await anil.device.tasks()) await anil.device.confirmDeal(t.engagement);
    await talk(rahul, anil, babu, chetan);

    const jobs = await rahul.device.jobs();
    const agreed = jobs.filter((j) => j.engagement.status === "agreed");
    expect(agreed).toHaveLength(1);
    expect(await rahul.device.tasks()).toEqual([]);
    const winner = [anil, babu, chetan].find((w) => w.session.user === agreed[0]?.engagement.counterpart) as Person;
    expect(agreed[0]?.contact).toEqual(winner.contact);
    for (const loser of [anil, babu, chetan].filter((w) => w !== winner)) {
      const theirs = (await loser.device.jobs()).filter((j) => j.engagement.counterpart === rahul.session.user);
      expect(theirs.every((j) => j.contact === undefined && j.engagement.status !== "agreed")).toBe(true);
      expect(await loser.device.tasks()).toEqual([]);
    }
  });

  it("Meera's budget is below every maid's minimum: no deal and no contact", async () => {
    const meera = await person("Meera", { autoConfirm: true, address: "Flat 8B" });
    const [job] = await meera.device.request(
      need("maid", centre, 30000, "Daily cleaning", { rooms: "2 rooms, sweeping and mopping", pets: "no" }),
      [gauri.session.user],
    );
    await talk(meera, gauri);
    const m = await meera.device.job(job?.engagement.id as EngagementId);
    expect(m.engagement.status).toBe("cancelled");
    expect(m.cancel?.reason).toBe("no_deal");
    expect(m.contact).toBeUndefined();
    expect((await gauri.device.job(m.engagement.id)).contact).toBeUndefined();
  });

  it("Kiran turns down the plumber's deal: cancelled on both phones, nothing shared", async () => {
    const kiran = await person("Kiran", { autoConfirm: false, address: "Villa 4" });
    const [job] = await kiran.device.request(
      need("plumber", centre, 60000, "Kitchen sink leaks", { problem: "pipe under the sink drips" }),
      [esha.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    await talk(kiran, esha);
    expect((await kiran.device.tasks())[0]).toMatchObject({ kind: TaskKind.confirmDeal, engagement: id });
    await kiran.device.declineDeal(id);
    await talk(kiran, esha);
    expect([await status(kiran, id), await status(esha, id)]).toEqual(["cancelled", "cancelled"]);
    expect((await esha.device.job(id)).cancel?.reason).toBe("declined_by_owner");
    expect((await esha.device.job(id)).contact).toBeUndefined();
  });

  it("a worker declines a job outside their trade or their area", async () => {
    const sunil = await person("Sunil", { autoConfirm: true });
    const [wrongTrade] = await sunil.device.request(need("electrician", centre, 60000, "Light flickers"), [
      esha.session.user,
    ]);
    const [tooFar] = await sunil.device.request(
      need("electrician", centre, 60000, "Light flickers", { problem: "flicker" }),
      [dinesh.session.user],
    );
    await talk(sunil, esha, dinesh);
    for (const j of [wrongTrade, tooFar]) {
      const mine = await sunil.device.job(j?.engagement.id as EngagementId);
      expect([mine.engagement.status, mine.cancel?.reason]).toEqual(["declined", "no_match"]);
    }
  });

  it("an AC repair is paid, and the technician disputes the payment", async () => {
    const neha = await person("Neha", { autoConfirm: true, address: "Tower B, 1104" });
    const [job] = await neha.device.request(
      need("ac_technician", centre, 90000, "AC not cooling", { problem: "runs but blows warm air" }),
      [imran.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    await talk(neha, imran);
    expect(await status(neha, id)).toBe("agreed");
    await imran.device.deliver(id, "Gas topped up");
    const asked = await imran.device.requestPayment(id, "AC service");
    await talk(neha, imran);
    await neha.device.markPaid(asked.id, "412345678999");
    await talk(neha, imran);
    await imran.device.disputePayment(asked.id);
    await talk(neha, imran);
    expect((await neha.device.payments.get(asked.id))?.status).toBe("disputed");
    expect((await imran.device.payments.get(asked.id))?.status).toBe("disputed");
  });

  it("the plumber is paid in cash before asking: recorded as cash on both phones and in her passbook", async () => {
    const lata = await person("Lata", { autoConfirm: true, address: "Flat 12, 2nd floor" });
    const [job] = await lata.device.request(
      need("plumber", centre, 60000, "Bathroom tap leaks", { problem: "tap drips all night" }),
      [esha.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    await talk(lata, esha);
    expect(await status(lata, id)).toBe("agreed");
    const price = (await esha.device.job(id)).mine?.terms.price_paise as number;
    await esha.device.deliver(id, "Washer replaced");
    const cash = await esha.device.recordCash(id);
    await talk(lata, esha);
    for (const p of [await esha.device.payments.get(cash.id), await lata.device.payments.get(cash.id)])
      expect(p).toMatchObject({ status: "confirmed", method: "cash", amount_paise: price });
    expect((await passbookOf(esha)).totals).toMatchObject({ week: price, waiting: 0, notAsked: 0 });
  });

  it("a worker who was offline catches up in order; a cancel after signing makes him forget the address", async () => {
    const asha = await person("Asha", { autoConfirm: true, address: "Row house 7" });
    const [job] = await asha.device.request(
      need("electrician", centre, 70000, "New light point", { problem: "add one light in the hall" }),
      [babu.session.user],
    );
    const id = job?.engagement.id as EngagementId;
    // Babu's phone is off: Asha's agent sends and waits.
    for (let i = 0; i < 3; i++) await asha.device.sync();
    expect(await status(asha, id)).toBe("sent");
    await talk(asha, babu);
    expect([await status(asha, id), await status(babu, id)]).toEqual(["agreed", "agreed"]);
    expect((await babu.device.job(id)).contact?.address).toBe("Row house 7");

    await asha.device.cancelJob(id);
    await talk(asha, babu);
    const b = await babu.device.job(id);
    expect(b.engagement.status).toBe("cancelled");
    expect(b.contact).toBeUndefined();
  });
});
