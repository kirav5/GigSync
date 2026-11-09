import { HttpMethod } from "@gigsync/core";
import { describe, expect, it } from "vitest";
import { sessionCache } from "../src/auth/session-cache.js";
import { SESSION_DAYS } from "../src/db/sessions.js";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";
import { sql } from "./sql.js";

/** Architecture review row 18: a session ends on its own, and a frozen account is refused with any token. */
describe("a session", () => {
  it("works until it is too old, then is refused", async () => {
    const p = await signIn("+919844700001");
    expect((await call(p, HttpMethod.get, "/inbox")).status).toBe(200);
    await sql("UPDATE sessions SET created_at = now() - make_interval(days => $2) WHERE token = $1", [
      p.session.token,
      SESSION_DAYS + 1,
    ]);
    // Backdating the row stands in for 180 days passing, by when the minute this isolate remembers it is long over.
    sessionCache.clear();
    expect((await call(p, HttpMethod.get, "/inbox")).status).toBe(401);
  });

  it("is refused once the account is frozen", async () => {
    const p = await signIn("+919844700002");
    await sql("UPDATE users SET status = 'frozen' WHERE user_id = $1", [p.session.user]);
    expect((await call(p, HttpMethod.get, "/inbox")).status).toBe(401);
  });
});
