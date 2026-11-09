import { BEARER_PREFIX, Header, HttpMethod } from "@gigsync/core/http";
import { log, pii } from "@gigsync/core/log";
import type { MiddlewareHandler } from "hono";
import { sessionCache } from "../auth/session-cache.js";
import { ApiError, type AppEnv, V1, V1_AUTH, Var } from "../context.js";
import type { Db } from "../db/client.js";
import { type SessionOwner, sessionOwner } from "../db/sessions.js";

/**
 * The only routes that may take a session on this isolate's word (auth/session-cache.ts) instead of asking the
 * directory: the ones an open phone calls over and over, where a session revoked elsewhere working for one more
 * TTL moves no money and changes no account. Everything not listed asks Postgres every time: sign-out, devices,
 * moving phones, admin, job records and payments, and any route added later until someone lists it here.
 */
const CACHED_ROUTES = [`${V1}/inbox`, `${V1}/model`];
/** The same, for reads only: posting to the board still asks the directory. */
const CACHED_READS = [`${V1}/board`, `${V1}/cities`];

const under = (path: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** Whether this request may be answered from the session cache. */
export const mayUseSessionCache = (method: string, path: string) =>
  under(path, CACHED_ROUTES) || (method === HttpMethod.get && under(path, CACHED_READS));

/** Asks the directory, and brings this isolate's memory in line with its answer: a yes is remembered, a no forgotten. */
async function askDirectory(db: Db, token: string, now: number, fresh: boolean): Promise<SessionOwner | undefined> {
  const session = await sessionOwner(db, token, now, fresh);
  if (session) sessionCache.remember(token, session, now);
  else sessionCache.forget(token);
  return session?.owner;
}

/** Every /v1 route except sign-in needs a live session; who it belongs to is set on the request. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.path.startsWith(`${V1_AUTH}/`)) return next();
  const header = c.req.header(Header.authorization);
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
  if (!token) return c.json({ error: ApiError.unauthorized }, 401);
  // One clock for the whole check: the cache's TTL and the session's expiry are judged at the same instant.
  const now = Date.now();
  const cached = mayUseSessionCache(c.req.method, c.req.path);
  const owner =
    (cached ? sessionCache.get(token, now) : undefined) ?? (await askDirectory(c.get(Var.db), token, now, !cached));
  if (!owner) {
    log.warn("session rejected", { requestId: c.get(Var.requestId), token: pii(token) });
    return c.json({ error: ApiError.unauthorized }, 401);
  }
  c.set(Var.user, owner.user_id);
  c.set(Var.device, owner.device_id);
  await next();
};
