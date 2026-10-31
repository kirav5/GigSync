import { HttpMethod } from "@gigsync/core";
import { MATCH_LIMIT, type MentorProfile, type MyMentorListing } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call, listing, match, mentor } from "./mentor-helpers.js";
import { signIn } from "./people.js";

const ME = "/mentors/me";
const MATCH = "/mentors/match";

describe("mentor listing", () => {
  it("publishes, reads back, replaces and deletes the caller's own listing", async () => {
    const m = await signIn("+919822200001");
    const put = await call(m, HttpMethod.put, ME, listing("Asha", ["cook"], { woman: true, open_slots: 3 }));
    expect(put.status).toBe(200);
    const { listing: stored } = (await put.json()) as MyMentorListing;
    expect(stored).toMatchObject({ first_name: "Asha", trades: ["cook"], languages: ["hi", "kn"], open_slots: 3 });
    expect(stored).toMatchObject({ woman: true, women_only_newcomers: false, active: true, vouched_by: null });

    await call(m, HttpMethod.put, ME, listing("Asha", ["driver"]));
    const got = (await (await call(m, HttpMethod.get, ME)).json()) as MyMentorListing;
    expect(got.listing.trades).toEqual(["driver"]);
    expect(got.listing.open_slots).toBe(2);

    expect((await call(m, HttpMethod.delete, ME)).status).toBe(204);
    expect((await call(m, HttpMethod.get, ME)).status).toBe(404);
    expect((await call(m, HttpMethod.delete, ME)).status).toBe(204);
  });

  it("refuses a listing below the minimum record or with bad fields", async () => {
    const m = await signIn("+919822200002");
    for (const bad of [
      listing("B", ["cook"], { months: 5 }),
      listing("B", ["cook"], { jobs: 19 }),
      listing("B", []),
      { ...listing("B", ["cook"]), city: "mumbai" },
      listing("B", ["cook"], { open_slots: 11 }),
    ]) {
      expect((await call(m, HttpMethod.put, ME, bad)).status).toBe(400);
    }
    expect((await call(m, HttpMethod.put, ME, "not json")).status).toBe(400);
  });

  it("needs a session for every mentor route", async () => {
    expect((await call(undefined, HttpMethod.put, ME, listing("C", ["cook"]))).status).toBe(401);
    expect((await call(undefined, HttpMethod.get, ME)).status).toBe(401);
    expect((await call(undefined, HttpMethod.delete, ME)).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, MATCH, { city: "bengaluru" })).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, "/mentors/report", {})).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, "/mentors/block", {})).status).toBe(401);
    expect((await call(undefined, HttpMethod.post, "/mentors/vouch", {})).status).toBe(401);
  });

  it("only ever changes the caller's own listing", async () => {
    const owner = await mentor("+919822200003", listing("Devi", ["plumber"]));
    const other = await signIn("+919822200004");
    expect((await call(other, HttpMethod.delete, ME)).status).toBe(204);
    expect(await match(other, { city: "bengaluru", trade: "plumber", lang: "kn" })).toEqual(["Devi"]);
    expect((await call(owner, HttpMethod.get, ME)).status).toBe(200);
  });
});

describe("matching", () => {
  it("filters by city, trade, language, open slots and active, most jobs first, never the caller", async () => {
    await mentor("+919822200010", listing("Few", ["painter"], { jobs: 25 }));
    await mentor("+919822200011", listing("Many", ["painter", "cook"], { jobs: 90 }));
    await mentor("+919822200012", listing("Full", ["painter"], { open_slots: 0 }));
    await mentor("+919822200013", listing("Paused", ["painter"], { active: false }));
    await mentor("+919822200014", listing("Tamil", ["painter"], { languages: ["en"] }));
    const self = await mentor("+919822200015", listing("Self", ["painter"], { jobs: 500 }));

    expect(await match(self, { city: "bengaluru", trade: "painter", lang: "kn" })).toEqual(["Many", "Few"]);
    expect(await match(self, { city: "bengaluru", trade: "painter", lang: "en" })).toEqual(["Tamil"]);
    expect(await match(self, { city: "bengaluru", trade: "carpenter", lang: "en" })).toEqual([]);
  });

  it("returns only the public profile", async () => {
    await mentor("+919822200020", listing("Gita", ["ac_technician"], { woman: true }));
    const newcomer = await signIn("+919822200021");
    const res = await call(newcomer, HttpMethod.post, MATCH, { city: "bengaluru", trade: "ac_technician", lang: "hi" });
    const { mentors } = (await res.json()) as { mentors: MentorProfile[] };
    expect(Object.keys(mentors[0] ?? {}).sort()).toEqual(
      ["area", "city", "first_name", "jobs", "languages", "months", "trades", "user", "vouched_by"].sort(),
    );
    expect(JSON.stringify(mentors)).not.toContain("9822200020");
  });

  it("women only: only women mentors, and women-only-newcomers listings only for a newcomer who is a woman", async () => {
    await mentor("+919822200030", listing("Ravi", ["maid"]));
    await mentor("+919822200031", listing("Lata", ["maid"], { woman: true, jobs: 40 }));
    await mentor("+919822200032", listing("Meena", ["maid"], { woman: true, women_only_newcomers: true, jobs: 60 }));
    // A man ticking women_only_newcomers is ignored: the flag counts only on a woman's listing.
    await mentor("+919822200033", listing("Suresh", ["maid"], { women_only_newcomers: true, jobs: 30 }));
    const her = await signIn("+919822200034");
    const him = await signIn("+919822200035");
    const q = { city: "bengaluru", trade: "maid", lang: "kn" } as const;

    expect(await match(her, { ...q, woman: true, women_only: true })).toEqual(["Meena", "Lata"]);
    expect(await match(her, { ...q, woman: true })).toEqual(["Meena", "Lata", "Suresh", "Ravi"]);
    expect(await match(him, q)).toEqual(["Lata", "Suresh", "Ravi"]);
    expect(await match(him, { ...q, women_only: true })).toEqual(["Lata"]);
  });

  it(`caps the answer at ${MATCH_LIMIT}`, async () => {
    const phones = Array.from({ length: MATCH_LIMIT + 2 }, (_, i) => `+9198222001${String(i).padStart(2, "0")}`);
    for (const phone of phones) await mentor(phone, listing("Cap", ["electrician"], { languages: ["en"] }));
    const newcomer = await signIn("+919822200199");
    expect(await match(newcomer, { city: "bengaluru", trade: "electrician", lang: "en" })).toHaveLength(MATCH_LIMIT);
  });

  it("refuses a bad match request", async () => {
    const newcomer = await signIn("+919822200040");
    for (const bad of [{}, { city: "mumbai", trade: "cook", lang: "kn" }, { city: "bengaluru", trade: "cook" }]) {
      expect((await call(newcomer, HttpMethod.post, MATCH, bad)).status).toBe(400);
    }
  });
});
