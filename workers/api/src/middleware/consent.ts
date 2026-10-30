import { log } from "@gigsync/core/log";
import { RecordRefusal } from "@gigsync/protocol";
import type { MiddlewareHandler } from "hono";
import { type AppEnv, Var } from "../context.js";
import { consentOf } from "../db/consents.js";

/**
 * Job-record writes need the current records notice accepted (ADR 0038 §5): without it, or after a newer notice, the
 * phone is told `no_consent` and shows the notice.
 */
export const requireConsent: MiddlewareHandler<AppEnv> = async (c, next) => {
  const consent = await consentOf(c.get(Var.db), c.get(Var.user));
  if (!consent?.current) {
    log.info("job record write without consent", { requestId: c.get(Var.requestId), user: c.get(Var.user) });
    return c.json({ error: RecordRefusal.enum.no_consent }, 403);
  }
  await next();
};
