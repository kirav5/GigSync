import { ContentType, Header } from "@collab/core/http";
import { configureLog, type Level, LogLevel, log, logEnabled, pii } from "@collab/core/log";
import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";
import { type AppEnv, Var } from "./context.js";

/** Bodies longer than this are cut in debug lines; a big upload would otherwise flood the console. */
const MAX_BODY = 4000;

async function bodyOf(r: Request | Response): Promise<string | undefined> {
  if (!r.headers.get(Header.contentType)?.startsWith(ContentType.json)) return undefined;
  const text = await r.clone().text();
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text;
}

/**
 * Configures the logger from this Worker's settings, tags each request with an id (Cloudflare's cf-ray when
 * present), echoes it back, and logs status and duration. Locally (debug) it also logs both bodies and the
 * session header; they are private, so nothing else ever prints them.
 */
/** 5xx is our fault (error), 4xx the caller's (warn), the rest is normal traffic (info). */
function levelFor(status: number): Level {
  if (status >= 500) return LogLevel.error;
  return status >= 400 ? LogLevel.warn : LogLevel.info;
}

export function requestLog(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    configureLog(c.env);
    const requestId = c.req.header(Header.cfRay) ?? crypto.randomUUID();
    c.set(Var.requestId, requestId);
    const start = Date.now();
    if (logEnabled(LogLevel.debug)) {
      log.debug("request in", {
        requestId,
        method: c.req.method,
        path: c.req.path,
        query: pii(c.req.query()),
        authorization: pii(c.req.header(Header.authorization)),
        body: pii(await bodyOf(c.req.raw)),
      });
    }
    await next();
    c.header(Header.requestId, requestId);
    const status = c.res.status;
    log[levelFor(status)]("request", {
      requestId,
      method: c.req.method,
      route: routePath(c),
      status,
      ms: Date.now() - start,
    });
    if (logEnabled(LogLevel.debug)) log.debug("response out", { requestId, body: pii(await bodyOf(c.res)) });
  };
}
