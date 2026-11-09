import { createExecutionContext, env } from "cloudflare:test";
import { BEARER_PREFIX, Header, HttpMethod, SecretKeys } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { type DeviceId, MAX_RECIPIENT_DEVICES, type UserId } from "@gigsync/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_CACHE_TTL_MS, SessionCache, sessionCache } from "../src/auth/session-cache.js";
import { withDirectory } from "../src/db/client.js";
import { type LiveSession, SESSION_DAYS, sessionOwner } from "../src/db/sessions.js";
import app from "../src/index.js";
import { mayUseSessionCache } from "../src/middleware/session.js";
import { call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";
import { sql } from "./sql.js";

const INBOX = "/inbox";
/** A route that never trusts the cache, and reads nothing but the session. */
const PUSH_KEY = "/devices/push-key";
const DAY_MS = 86_400_000;
/** Nothing listens here: any request that reaches for the directory fails instead of answering. */
const NO_DIRECTORY = { connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none" };

/** Calls the Worker with a directory that cannot be reached: only a request that needs no connection succeeds. */
function callWithoutDirectory(as: Person, path: string): Promise<Response> {
  const request = new Request(`http://x/v1${path}`, {
    headers: { [Header.authorization]: `${BEARER_PREFIX}${as.session.token}` },
  });
  return Promise.resolve(app.fetch(request, { ...env, DIRECTORY: NO_DIRECTORY }, createExecutionContext()));
}

const status = async (as: Person, path: string, method: string = HttpMethod.get) =>
  (await call(as, method, path)).status;

/** What another isolate's sign-out leaves behind: the rows revoked, and this isolate's cache none the wiser. */
const revokeElsewhere = (p: Person) =>
  sql("UPDATE sessions SET revoked_at = now() WHERE token = $1", [p.session.token]);

const session = (device: string, endsAt: number): LiveSession => ({
  owner: { user_id: "usr_test" as UserId, device_id: device as DeviceId },
  endsAt,
});

beforeEach(() => sessionCache.clear());

describe("a remembered session", () => {
  it("answers the inbox poll without a directory connection", async () => {
    const p = await signIn("+919844710001");
    // Not remembered yet: the poll has to ask the directory, and there is none.
    expect((await callWithoutDirectory(p, INBOX)).status).toBe(500);
    expect(await status(p, INBOX)).toBe(200);
    expect((await callWithoutDirectory(p, INBOX)).status).toBe(200);
  });

  it("is not trusted by a sensitive route, which still asks the directory", async () => {
    const p = await signIn("+919844710002");
    expect(await status(p, INBOX)).toBe(200);
    expect((await callWithoutDirectory(p, PUSH_KEY)).status).toBe(500);
    expect(await status(p, PUSH_KEY)).toBe(200);
  });

  it("is never a refusal: an account unfrozen is let in on its next call", async () => {
    const p = await signIn("+919844710003");
    await sql("UPDATE users SET status = 'frozen' WHERE user_id = $1", [p.session.user]);
    expect(await status(p, INBOX)).toBe(401);
    expect(sessionCache.size).toBe(0);
    await sql("UPDATE users SET status = 'active' WHERE user_id = $1", [p.session.user]);
    expect(await status(p, INBOX)).toBe(200);
  });

  it("is forgotten at sign-out: the same isolate refuses the token at once", async () => {
    const p = await signIn("+919844710004");
    expect(await status(p, INBOX)).toBe(200);
    expect(await status(p, "/me/signout", HttpMethod.post)).toBe(204);
    expect((await callWithoutDirectory(p, INBOX)).status).toBe(500);
    expect(await status(p, INBOX)).toBe(401);
  });

  it("is forgotten when another of the person's phones revokes the device", async () => {
    const old = await signIn("+919844710005");
    const next = await signIn("+919844710005");
    expect(await status(old, INBOX)).toBe(200);
    expect(await status(next, `/devices/${old.session.device}`, HttpMethod.delete)).toBe(204);
    expect(await status(old, INBOX)).toBe(401);
  });

  it("is forgotten when a new sign-in retires the oldest phone", async () => {
    const phone = "+919844710006";
    const oldest = await signIn(phone, new SecretKeys(newDeviceSecrets()), "10.1.0.0");
    expect(await status(oldest, INBOX)).toBe(200);
    for (let i = 1; i <= MAX_RECIPIENT_DEVICES; i++)
      await signIn(phone, new SecretKeys(newDeviceSecrets()), `10.1.0.${i}`);
    expect(await status(oldest, INBOX)).toBe(401);
  });
});

describe("a session ended outside this isolate", () => {
  it("revoked: a sensitive route refuses it at once, and its refusal ends the cached routes too", async () => {
    const p = await signIn("+919844710007");
    expect(await status(p, INBOX)).toBe(200);
    await revokeElsewhere(p);
    // The stated price of the cache: the poll keeps answering here for up to SESSION_CACHE_TTL_MS.
    expect(await status(p, INBOX)).toBe(200);
    expect(await status(p, PUSH_KEY)).toBe(401);
    expect(await status(p, INBOX)).toBe(401);
  });

  it("frozen: a sensitive route refuses it at once", async () => {
    const p = await signIn("+919844710008");
    expect(await status(p, INBOX)).toBe(200);
    await sql("UPDATE users SET status = 'frozen' WHERE user_id = $1", [p.session.user]);
    expect(await status(p, "/me/signout", HttpMethod.post)).toBe(401);
    expect(await status(p, INBOX)).toBe(401);
  });

  it("too old: a sensitive route refuses it at once", async () => {
    const p = await signIn("+919844710009");
    expect(await status(p, INBOX)).toBe(200);
    await sql("UPDATE sessions SET created_at = now() - make_interval(days => $2) WHERE token = $1", [
      p.session.token,
      SESSION_DAYS + 1,
    ]);
    expect(await status(p, PUSH_KEY)).toBe(401);
  });
});

describe("a session's expiry", () => {
  const owner = (p: Person, now: number) =>
    withDirectory(env.DIRECTORY.connectionString, undefined, (db) => sessionOwner(db, p.session.token, now));

  it("is judged by the clock it is given", async () => {
    const p = await signIn("+919844710010");
    const now = Date.now();
    const late = now + SESSION_DAYS * DAY_MS;
    expect((await owner(p, now))?.owner.device_id).toBe(p.session.device);
    expect(await owner(p, late - DAY_MS)).toBeDefined();
    expect(await owner(p, late + DAY_MS)).toBeUndefined();
  });

  it("ends a remembered session too, before the TTL when it comes first", () => {
    const cache = new SessionCache();
    cache.remember("ses_a", session("dev_a", 1_500), 1_000);
    expect(cache.get("ses_a", 1_499)).toBeDefined();
    expect(cache.get("ses_a", 1_500)).toBeUndefined();
  });
});

describe("the session cache", () => {
  const FAR = Number.MAX_SAFE_INTEGER;

  it("forgets a session after its TTL", () => {
    const cache = new SessionCache();
    cache.remember("ses_a", session("dev_a", FAR), 0);
    expect(cache.get("ses_a", SESSION_CACHE_TTL_MS - 1)?.device_id).toBe("dev_a");
    expect(cache.get("ses_a", SESSION_CACHE_TTL_MS)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("stays within its size: the one remembered longest ago goes first", () => {
    const cache = new SessionCache(SESSION_CACHE_TTL_MS, 2);
    cache.remember("ses_a", session("dev_a", FAR), 0);
    cache.remember("ses_b", session("dev_b", FAR), 0);
    cache.remember("ses_a", session("dev_a", FAR), 1);
    cache.remember("ses_c", session("dev_c", FAR), 2);
    expect(cache.size).toBe(2);
    expect(cache.get("ses_b", 3)).toBeUndefined();
    expect(cache.get("ses_a", 3)).toBeDefined();
  });

  it("does not remember a revoked device again from a lookup that began before the revocation", () => {
    const cache = new SessionCache();
    cache.remember("ses_a", session("dev_a", FAR), 0);
    cache.remember("ses_b", session("dev_b", FAR), 0);
    cache.forgetDevices(["dev_a" as DeviceId], 10);
    expect(cache.get("ses_a", 11)).toBeUndefined();
    expect(cache.get("ses_b", 11)).toBeDefined();
    cache.remember("ses_a", session("dev_a", FAR), 12);
    expect(cache.get("ses_a", 13)).toBeUndefined();
  });

  it("is used only by the polled and read-only routes", () => {
    const cached: [string, string][] = [
      [HttpMethod.get, "/v1/inbox"],
      [HttpMethod.post, "/v1/inbox/ack"],
      [HttpMethod.post, "/v1/inbox/claims"],
      [HttpMethod.post, "/v1/model/generate"],
      [HttpMethod.get, "/v1/board/search"],
      [HttpMethod.get, "/v1/cities"],
    ];
    const asked: [string, string][] = [
      [HttpMethod.post, "/v1/me/signout"],
      [HttpMethod.delete, "/v1/me/records"],
      [HttpMethod.delete, "/v1/devices/dev_1"],
      [HttpMethod.post, "/v1/transfer"],
      [HttpMethod.get, "/v1/admin/analytics/earnings"],
      [HttpMethod.post, "/v1/jobs/records"],
      [HttpMethod.post, "/v1/board"],
      [HttpMethod.post, "/v1/mailbox/usr_1"],
      [HttpMethod.get, "/v1/inboxes"],
    ];
    for (const [method, path] of cached) expect(mayUseSessionCache(method, path), path).toBe(true);
    for (const [method, path] of asked) expect(mayUseSessionCache(method, path), path).toBe(false);
  });
});
