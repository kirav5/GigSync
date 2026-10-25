import { SELF } from "cloudflare:test";
import { HttpError } from "@gigsync/core";
import type { BoardProfile, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { signIn } from "./people.js";

/** Kochi, so these workers never meet the ones other test files put near Bengaluru. */
const HERE = { lat: 9.97, lon: 76.28 };
/** Roughly this many kilometres north of HERE. */
const north = (km: number) => ({ lat: HERE.lat + km / 111, lon: HERE.lon });

const card = (name: string, trades: Trade[], km: number, rate: number): BoardProfile => ({
  display_name: name,
  trades,
  area: north(km),
  area_name: "Kochi",
  rate_paise: rate,
  languages: ["ml", "en"],
  about: "",
});

async function list(name: string, phone: string, trades: Trade[], km: number, rate: number) {
  const p = await signIn(phone);
  await p.api.publishProfile(card(name, trades, km, rate));
  return p;
}

describe("job board", () => {
  it("finds workers of one trade inside the radius, nearest first", async () => {
    const near = await list("Anil", "+919811100001", ["electrician"], 1, 60000);
    const both = await list("Babu", "+919811100002", ["electrician", "plumber"], 3, 50000);
    await list("Chacko", "+919811100003", ["electrician"], 30, 40000);
    await list("Devi", "+919811100004", ["maid"], 1, 30000);
    const consumer = await signIn("+919811100005");

    const found = await consumer.api.searchWorkers({ trade: "electrician", ...HERE, radius_km: 5 });
    expect(found.map((w) => w.display_name)).toEqual(["Anil", "Babu"]);
    expect(found.map((w) => w.user)).toEqual([near.session.user, both.session.user]);
    expect(found[0]?.distance_km).toBeCloseTo(1, 0);
    expect(found[1]?.trades).toEqual(["electrician", "plumber"]);

    const plumbers = await consumer.api.searchWorkers({ trade: "plumber", ...HERE });
    expect(plumbers.map((w) => w.display_name)).toEqual(["Babu"]);
    expect(await consumer.api.searchWorkers({ trade: "painter", ...HERE })).toEqual([]);
    const cheap = await consumer.api.searchWorkers({ trade: "electrician", ...HERE, max_rate_paise: 55000 });
    expect(cheap.map((w) => w.display_name)).toEqual(["Babu"]);
  });

  it("stores the area rounded to about a kilometre and never a phone number", async () => {
    const w = await signIn("+919811100006");
    await w.api.publishProfile({ ...card("Elias", ["carpenter"], 0, 70000), area: { lat: 9.97123, lon: 76.28456 } });
    const [found] = await w.api.searchWorkers({ trade: "carpenter", ...HERE });
    expect(found?.area).toEqual({ lat: 9.97, lon: 76.28 });
    expect(JSON.stringify(found)).not.toContain("9811100006");
  });

  it("replaces a card on republish and drops it on unlist", async () => {
    const w = await signIn("+919811100007");
    await w.api.publishProfile(card("Fathima", ["cook"], 2, 40000));
    await w.api.publishProfile(card("Fathima", ["driver"], 2, 45000));
    expect(await w.api.searchWorkers({ trade: "cook", ...HERE })).toEqual([]);
    expect((await w.api.searchWorkers({ trade: "driver", ...HERE }))[0]?.rate_paise).toBe(45000);
    expect(await w.api.removeProfile()).toBe(true);
    expect(await w.api.searchWorkers({ trade: "driver", ...HERE })).toEqual([]);
    expect(await w.api.removeProfile()).toBe(false);
  });

  it("refuses bad cards and bad queries", async () => {
    const w = await signIn("+919811100008");
    await expect(w.api.publishProfile({ ...card("G", ["maid"], 1, 100), trades: [] })).rejects.toMatchObject({
      status: 400,
    });
    await expect(w.api.searchWorkers({ trade: "astronaut" as Trade, ...HERE })).rejects.toBeInstanceOf(HttpError);
    await expect(w.api.searchWorkers({ trade: "maid", ...HERE, radius_km: 500 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("needs a session to publish or search", async () => {
    expect((await SELF.fetch("http://x/v1/board/workers?trade=maid&lat=9&lon=76")).status).toBe(401);
    const put = await SELF.fetch("http://x/v1/board/profile", {
      method: "PUT",
      body: JSON.stringify(card("H", ["maid"], 1, 100)),
    });
    expect(put.status).toBe(401);
  });
});
