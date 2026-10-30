import { log } from "@gigsync/core/log";
import { ConsentAccept, RECORDS_NOTICE_VERSION, RecordRefusal } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { acceptNotice, consentOf } from "../db/consents.js";

/**
 * The job-records notice (ADR 0038 §5), behind the session middleware: what the person accepted, and accepting the
 * notice shown now. Only the current version can be accepted; an app showing an older notice is told so.
 */
export const consent = new Hono<AppEnv>();

consent.get("/", async (c) => {
  const state = await consentOf(c.get(Var.db), c.get(Var.user));
  if (!state) return c.json({ error: ApiError.notFound }, 404);
  return c.json(state);
});

consent.put("/", async (c) => {
  const accept = ConsentAccept.safeParse(await c.req.json().catch(() => null));
  if (!accept.success) return c.json({ error: ApiError.badRequest }, 400);
  if (accept.data.notice_version !== RECORDS_NOTICE_VERSION)
    return c.json({ error: RecordRefusal.enum.stale_notice }, 409);
  const state = await acceptNotice(c.get(Var.db), c.get(Var.user), new Date());
  log.info("records notice accepted", { requestId: c.get(Var.requestId), user: c.get(Var.user) });
  return c.json(state);
});
