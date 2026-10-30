import { log } from "@gigsync/core/log";
import { EarningsQuery, type EarningsReport } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { monthlyEarnings } from "../db/analytics.js";
import { requireAdmin } from "../middleware/admin.js";

/**
 * Admin only, behind the session middleware and the admin key (like the mentors' vouch): per-worker aggregates for
 * analytics and incentives (ADR 0038 §3). No UI; nobody is admin while ADMIN_KEY is unset.
 */
export const admin = new Hono<AppEnv>();

admin.use("*", requireAdmin);

admin.get("/analytics/earnings", async (c) => {
  const q = EarningsQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: ApiError.badRequest }, 400);
  const rows = await monthlyEarnings(c.get(Var.db), q.data);
  log.info("earnings analytics read", { requestId: c.get(Var.requestId), user: c.get(Var.user), rows: rows.length });
  return c.json({ rows } satisfies EarningsReport);
});
