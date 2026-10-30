import { EnvelopeKind } from "@gigsync/protocol";
import { describe, expect, it, vi } from "vitest";
import { countForRecord } from "../src/record/count.js";
import { envelope, post, signIn } from "./people.js";
import { agree, cardOf, deliver, listed, newEngagement, review, signedJob } from "./record-helpers.js";
import { sql } from "./sql.js";

/** What the worker's phone claims: more than any test here delivers, so every served count is the server's. */
const CLAIM = { jobs: 50, rated: 40, average: 4.8, came_back: 20 };

describe("counting a worker's record on delivery", () => {
  it("counts a job once both sides signed, a review once per household per job, and a household that came back", async () => {
    const w = await listed("+919877700001", "Basava", CLAIM);
    const home = await signIn("+919877700002");
    const viewer = await signIn("+919877700003");
    const first = newEngagement();

    await agree(home, w, first);
    expect((await cardOf(viewer, w.session.user)).record).toBeUndefined();
    await agree(w, home, first);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 1, rated: 0, came_back: 0 });

    // A review, the same envelope again, and a second review envelope on the same job: one rating.
    const once = await envelope(home, w, EnvelopeKind.enum.review, {}, first);
    expect(await post(home, once)).toBe(201);
    expect(await post(home, once)).toBe(200);
    await review(home, w, first);
    // A signature delivered twice changes nothing either.
    await agree(w, home, first);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 1, rated: 1, came_back: 0 });

    await signedJob(w, home);
    expect((await cardOf(viewer, w.session.user)).record).toEqual({ jobs: 2, rated: 1, came_back: 1 });
  });

  it("does not count a review on a job only one side signed, nor one before signing", async () => {
    const w = await listed("+919877700004", "Chennamma", CLAIM);
    const home = await signIn("+919877700005");
    const half = newEngagement();
    await agree(w, home, half);
    await review(home, w, half);
    const early = newEngagement();
    await review(home, w, early);
    await agree(home, w, early);
    await agree(w, home, early);
    expect((await cardOf(home, w.session.user)).record).toEqual({ jobs: 1, rated: 0, came_back: 0 });
  });

  it("never counts a job a user signs with themselves", async () => {
    const w = await listed("+919877700006", "Dyavamma", CLAIM);
    const mine = newEngagement();
    await agree(w, w, mine);
    await review(w, w, mine);
    expect((await cardOf(w, w.session.user)).record).toBeUndefined();
    expect(await sql("SELECT 1 FROM engagement_signatures WHERE signer_id = $1", [w.session.user])).toEqual([]);
  });

  it("counts other kinds not at all", async () => {
    const w = await listed("+919877700007", "Eranna", CLAIM);
    const home = await signIn("+919877700008");
    const e = newEngagement();
    await deliver(home, w, EnvelopeKind.enum.request, e);
    await deliver(w, home, EnvelopeKind.enum.quote, e);
    expect(await sql("SELECT 1 FROM engagement_signatures WHERE counterpart_id = $1", [w.session.user])).toEqual([]);
  });

  it("stores headers only: who signed with whom on which engagement, nothing of the content", async () => {
    const w = await listed("+919877700009", "Fakirappa", CLAIM);
    const home = await signIn("+919877700010");
    const e = await signedJob(w, home);
    const rows = await sql("SELECT * FROM engagement_signatures WHERE signer_id = $1", [w.session.user]);
    expect(rows).toEqual([{ signer_id: w.session.user, counterpart_id: home.session.user, engagement_id: e }]);
  });

  it("never fails a delivery because counting failed", async () => {
    const broken = {
      query: () => Promise.reject(new Error("connection lost")),
    } as unknown as Parameters<typeof countForRecord>[0];
    const w = await signIn("+919877700011");
    const home = await signIn("+919877700012");
    const e = await envelope(home, w, EnvelopeKind.enum.agree, {});
    await expect(countForRecord(broken, e, "test")).resolves.toBeUndefined();
  });

  it("does not count an envelope that arrives already expired", async () => {
    const w = await listed("+919877700013", "Gangamma", CLAIM);
    const home = await signIn("+919877700014");
    const e = await envelope(home, w, EnvelopeKind.enum.agree, {});
    const stale = { ...e, expires_at: new Date(Date.now() - 1000).toISOString() };
    const query = vi.fn();
    await countForRecord({ query } as unknown as Parameters<typeof countForRecord>[0], stale, "test");
    expect(query).not.toHaveBeenCalled();
  });
});
