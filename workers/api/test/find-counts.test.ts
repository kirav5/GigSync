import { createExecutionContext, env } from "cloudflare:test";
import { HttpMethod } from "@gigsync/core";
import type { FindCounts } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import app from "../src/index.js";
import { ADMIN_HEADER, ADMIN_KEY, call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

const COUNT = "/find/count";
const READ = "/admin/analytics/find";

describe("Find's daily counts (ADR 0060)", () => {
  it("adds up by day and event, and says nothing of who", async () => {
    const owner = await signIn("+919822500001");
    for (const event of ["typed", "typed", "tapped"])
      expect((await call(owner, HttpMethod.post, COUNT, { event })).status).toBe(204);
    const res = await call(owner, HttpMethod.get, `${READ}?days=2`, undefined, { [ADMIN_HEADER]: ADMIN_KEY });
    const { rows } = (await res.json()) as FindCounts;
    expect(rows.find((r) => r.event === "typed")?.count).toBeGreaterThanOrEqual(2);
    expect(rows.find((r) => r.event === "tapped")?.count).toBeGreaterThanOrEqual(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["count", "day", "event"]);
  });

  it("refuses an event not on the list, and more days than it keeps", async () => {
    const owner = await signIn("+919822500002");
    expect((await call(owner, HttpMethod.post, COUNT, { event: "my tv is broken" })).status).toBe(400);
    const far = await call(owner, HttpMethod.get, `${READ}?days=9999`, undefined, { [ADMIN_HEADER]: ADMIN_KEY });
    expect(far.status).toBe(400);
  });

  it("reads only for an admin, and counts only with a session", async () => {
    const owner = await signIn("+919822500003");
    expect((await call(owner, HttpMethod.get, READ)).status).toBe(403);
    const res = await app.fetch(
      new Request(`http://localhost/v1${COUNT}`, { method: HttpMethod.post, body: '{"event":"typed"}' }),
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(401);
  });
});
