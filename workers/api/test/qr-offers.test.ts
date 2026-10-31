import { HttpMethod } from "@gigsync/core";
import { OFFERS_PER_HOUSEHOLD_DAY, OFFERS_PER_WORKER_DAY, OfferRefusal } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { envelope, post, signIn } from "./people.js";
import { card, householdWithCode, listedWorker, worker } from "./qr-helpers.js";
import { sql } from "./sql.js";

const R = OfferRefusal.enum;
const offer = { card: card("Meena") };
const status = (p: Promise<unknown>) => p.then(() => 204).catch((err: { status: number }) => err.status);
const refusal = async (res: Response) => ((await res.json()) as { error: string }).error;

describe("offers to work", () => {
  it("lets a listed worker offer through a household's live code, then send one work_offer", async () => {
    const meena = await listedWorker("+919866610001", "Meena");
    const { home, code } = await householdWithCode("+919866610002", "Priya");
    // No offer taken yet: the mailbox refuses the envelope.
    expect(await post(meena, await envelope(meena, home, "work_offer", offer))).toBe(403);
    await meena.api.takeOffer(code);
    expect(await post(meena, await envelope(meena, home, "work_offer", offer))).toBe(201);
    const [received] = await home.api.inbox();
    expect(received?.kind).toBe("work_offer");
  });

  it("refuses the envelope once the offer is an hour old, or the household made a new QR", async () => {
    const w = await listedWorker("+919866610003", "Ravi");
    const { home, code } = await householdWithCode("+919866610004", "Lakshmi");
    await w.api.takeOffer(code);
    await sql("UPDATE qr_offers SET offered_at = now() - interval '2 hours' WHERE worker_id = $1", [w.session.user]);
    expect(await post(w, await envelope(w, home, "work_offer", offer))).toBe(403);

    const other = await listedWorker("+919866610005", "Kiran");
    await other.api.takeOffer(code);
    await home.api.replaceQr({ role: "household", first_name: "Lakshmi" });
    expect(await post(other, await envelope(other, home, "work_offer", offer))).toBe(403);
    expect(await status(other.api.takeOffer(code))).toBe(404);
  });

  it("allows one offer a day through one code, and caps each worker's day", async () => {
    const w = await listedWorker("+919866610006", "Asha");
    const homes = await Promise.all(
      Array.from({ length: OFFERS_PER_WORKER_DAY + 1 }, (_, i) =>
        householdWithCode(`+9198666107${String(i).padStart(2, "0")}`, `Home ${i}`),
      ),
    );
    const [first, ...rest] = homes;
    if (!first) throw new Error("no households");
    await w.api.takeOffer(first.code);
    const again = await call(w, HttpMethod.post, `/qr/${first.code}/offer`);
    expect([again.status, await refusal(again)]).toEqual([429, R.offered_today]);
    for (const h of rest.slice(0, OFFERS_PER_WORKER_DAY - 1)) await w.api.takeOffer(h.code);
    const last = rest.at(-1);
    if (!last) throw new Error("no last household");
    const capped = await call(w, HttpMethod.post, `/qr/${last.code}/offer`);
    expect([capped.status, await refusal(capped)]).toEqual([429, R.worker_limit]);
    // A day later the worker may offer again.
    await sql("UPDATE qr_offers SET offered_at = now() - interval '25 hours' WHERE worker_id = $1", [w.session.user]);
    await w.api.takeOffer(last.code);
  });

  it("caps the offers one household receives in a day", async () => {
    const { home, code } = await householdWithCode("+919866610007", "Busy");
    const offered = await listedWorker("+919866610008", "First");
    await offered.api.takeOffer(code);
    // The rest of the day's offers, from workers made up for this test.
    await sql(
      `WITH made AS (INSERT INTO users (user_id, created_at)
         SELECT $2 || g, now() FROM generate_series(1, $3) g RETURNING user_id)
       INSERT INTO qr_offers (worker_id, code, offered_at) SELECT user_id, $1, now() FROM made`,
      [code, `usr_${home.session.user.slice(-8)}`, OFFERS_PER_HOUSEHOLD_DAY - 1],
    );
    const late = await listedWorker("+919866610009", "Late");
    const res = await call(late, HttpMethod.post, `/qr/${code}/offer`);
    expect([res.status, await refusal(res)]).toEqual([429, R.household_limit]);
  });

  it("refuses offers to a worker's code, to one's own code, and from someone with no card", async () => {
    const w = await listedWorker("+919866610010", "Mohan");
    const { code: workerCode } = await w.api.myQr(worker("Mohan"));
    const other = await listedWorker("+919866610011", "Suresh");
    const toWorker = await call(other, HttpMethod.post, `/qr/${workerCode}/offer`);
    expect([toWorker.status, await refusal(toWorker)]).toEqual([403, R.not_household]);

    const { home, code } = await householdWithCode("+919866610012", "Geeta");
    const own = await call(home, HttpMethod.post, `/qr/${code}/offer`);
    expect([own.status, await refusal(own)]).toEqual([403, R.not_household]);
    const unlisted = await signIn("+919866610013");
    const noCard = await call(unlisted, HttpMethod.post, `/qr/${code}/offer`);
    expect([noCard.status, await refusal(noCard)]).toEqual([403, R.no_card]);
    expect((await call(unlisted, HttpMethod.post, "/qr/bad/offer")).status).toBe(400);
  });
});
