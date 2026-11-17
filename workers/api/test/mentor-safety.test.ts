import { HttpMethod } from "@gigsync/core";
import { type MyMentorListing, REPORT_SUSPEND } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ADMIN_HEADER, ADMIN_KEY, call, listing, match, mentor } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { sql } from "./sql.js";

const REPORT = "/mentors/report";
const BLOCK = "/mentors/block";
const UNBLOCK = "/mentors/unblock";
const VOUCH = "/mentors/vouch";
const UNKNOWN_USER = "usr_01J0000000000000000000ZZZZ";
/** Other files list mentors too (one Postgres for the run), so these tests look only for their own mentor. */
const q = (trade: "cook" | "carpenter" | "driver") => ({ city: "bengaluru", trade, lang: "kn" }) as const;

describe("block", () => {
  it("hides the pair from each other's matches, whichever side blocked", async () => {
    const m = await mentor("+919833300001", listing("Kiran", ["cook"]));
    const blocker = await signIn("+919833300002");
    const blocked = await signIn("+919833300003");
    expect(await match(blocker, q("cook"))).toContain("Kiran");

    expect((await call(blocker, HttpMethod.post, BLOCK, { user: m.session.user })).status).toBe(204);
    expect((await call(blocker, HttpMethod.post, BLOCK, { user: m.session.user })).status).toBe(204);
    expect(await match(blocker, q("cook"))).not.toContain("Kiran");

    // The mentor blocks a newcomer: that newcomer no longer sees the mentor either.
    expect(await match(blocked, q("cook"))).toContain("Kiran");
    expect((await call(m, HttpMethod.post, BLOCK, { user: blocked.session.user })).status).toBe(204);
    expect(await match(blocked, q("cook"))).not.toContain("Kiran");
  });

  it("refuses blocking oneself, nobody, or a bad body", async () => {
    const p = await signIn("+919833300004");
    expect((await call(p, HttpMethod.post, BLOCK, { user: p.session.user })).status).toBe(400);
    expect((await call(p, HttpMethod.post, BLOCK, { user: "usr_x" })).status).toBe(400);
    expect((await call(p, HttpMethod.post, BLOCK, { user: UNKNOWN_USER })).status).toBe(404);
  });
});

describe("unblock", () => {
  it("lifts the caller's own block, and only theirs: the other side's block stands", async () => {
    const m = await mentor("+919833300050", listing("Leela", ["cook"]));
    const p = await signIn("+919833300051");
    expect((await call(p, HttpMethod.post, BLOCK, { user: m.session.user })).status).toBe(204);
    expect(await match(p, q("cook"))).not.toContain("Leela");
    expect((await call(p, HttpMethod.post, UNBLOCK, { user: m.session.user })).status).toBe(204);
    expect((await call(p, HttpMethod.post, UNBLOCK, { user: m.session.user })).status).toBe(204);
    expect(await match(p, q("cook"))).toContain("Leela");

    // Leela blocks him; him "unblocking" her lifts nothing, as he never blocked her.
    expect((await call(m, HttpMethod.post, BLOCK, { user: p.session.user })).status).toBe(204);
    expect((await call(p, HttpMethod.post, UNBLOCK, { user: m.session.user })).status).toBe(204);
    expect(await match(p, q("cook"))).not.toContain("Leela");
  });

  it("refuses unblocking oneself or a bad body", async () => {
    const p = await signIn("+919833300052");
    expect((await call(p, HttpMethod.post, UNBLOCK, { user: p.session.user })).status).toBe(400);
    expect((await call(p, HttpMethod.post, UNBLOCK, { user: "usr_x" })).status).toBe(400);
  });
});

describe("report", () => {
  it(`leaves a mentor out of matching once ${REPORT_SUSPEND} different people report them, until reviewed`, async () => {
    const m = await mentor("+919833300010", listing("Mohan", ["carpenter"]));
    const reporters = await Promise.all(Array.from({ length: REPORT_SUSPEND }, (_, i) => signIn(`+91983330002${i}`)));
    const [first, ...rest] = reporters;
    if (!first) throw new Error("no reporter");
    const reportAs = (p: typeof first, reason: string) =>
      call(p, HttpMethod.post, REPORT, { user: m.session.user, reason });

    // One person reporting again does not count twice.
    for (let i = 0; i < REPORT_SUSPEND; i++) expect((await reportAs(first, "asked_money")).status).toBe(204);
    expect(await match(first, q("carpenter"))).toContain("Mohan");

    for (const p of rest) expect((await reportAs(p, "asked_documents")).status).toBe(204);
    expect(await match(first, q("carpenter"))).not.toContain("Mohan");

    await sql("UPDATE mentor_reports SET reviewed_at = now() WHERE reported_id = $1", [m.session.user]);
    expect(await match(first, q("carpenter"))).toContain("Mohan");
  });

  it("stores the reason, never free text, and refuses reporting oneself or nobody", async () => {
    const m = await mentor("+919833300030", listing("Nanda", ["driver"]));
    const p = await signIn("+919833300031");
    expect((await call(p, HttpMethod.post, REPORT, { user: m.session.user, reason: "call 98..." })).status).toBe(400);
    expect((await call(p, HttpMethod.post, REPORT, { user: p.session.user, reason: "rude" })).status).toBe(400);
    expect((await call(p, HttpMethod.post, REPORT, { user: UNKNOWN_USER, reason: "rude" })).status).toBe(404);
    expect((await call(p, HttpMethod.post, REPORT, { user: m.session.user, reason: "unsafe" })).status).toBe(204);
    const rows = await sql<{ reason: string }>("SELECT reason FROM mentor_reports WHERE reported_id = $1", [
      m.session.user,
    ]);
    expect(rows).toEqual([{ reason: "unsafe" }]);
  });
});

describe("vouch", () => {
  it("sets and clears the badge with the admin key, and publishing again keeps it", async () => {
    const m = await mentor("+919833300040", listing("Prema", ["cook"], { languages: ["en"] }));
    const admin = await signIn("+919833300041");
    const vouch = (vouched_by: string | null) =>
      call(admin, HttpMethod.post, VOUCH, { user: m.session.user, vouched_by }, { [ADMIN_HEADER]: ADMIN_KEY });

    expect((await vouch("Domestic Workers Rights Union")).status).toBe(204);
    await call(m, HttpMethod.put, "/mentors/me", listing("Prema", ["cook"], { languages: ["en"] }));
    const own = (await (await call(m, HttpMethod.get, "/mentors/me")).json()) as MyMentorListing;
    expect(own.listing.vouched_by).toBe("Domestic Workers Rights Union");
    const res = await call(admin, HttpMethod.post, "/mentors/match", { city: "bengaluru", trade: "cook", lang: "en" });
    expect(await res.text()).toContain("Domestic Workers Rights Union");

    expect((await vouch(null)).status).toBe(204);
    const cleared = (await (await call(m, HttpMethod.get, "/mentors/me")).json()) as MyMentorListing;
    expect(cleared.listing.vouched_by).toBeNull();
  });

  it("refuses without the right admin key, a bad body, or someone with no listing", async () => {
    const m = await mentor("+919833300050", listing("Rani", ["cook"]));
    const p = await signIn("+919833300051");
    const body = { user: m.session.user, vouched_by: "Self-made union" };
    expect((await call(p, HttpMethod.post, VOUCH, body)).status).toBe(403);
    expect((await call(p, HttpMethod.post, VOUCH, body, { [ADMIN_HEADER]: "guess" })).status).toBe(403);
    expect((await call(p, HttpMethod.post, VOUCH, { user: "x" }, { [ADMIN_HEADER]: ADMIN_KEY })).status).toBe(400);
    const nobody = { user: p.session.user, vouched_by: "A union" };
    expect((await call(p, HttpMethod.post, VOUCH, nobody, { [ADMIN_HEADER]: ADMIN_KEY })).status).toBe(404);
  });
});
