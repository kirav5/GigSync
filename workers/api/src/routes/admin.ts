import { log } from "@gigsync/core/log";
import { CityUpsert, EarningsQuery, type EarningsReport, type FindCounts, FindCountsQuery } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { monthlyEarnings } from "../db/analytics.js";
import { upsertCity } from "../db/cities.js";
import { transaction } from "../db/client.js";
import { findCounts } from "../db/find-counts.js";
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

admin.get("/analytics/find", async (c) => {
  const q = FindCountsQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: ApiError.badRequest }, 400);
  return c.json({ rows: await findCounts(c.get(Var.db), q.data) } satisfies FindCounts);
});

/** Adds or changes a served city and its areas (ADR 0061): a new city is data, not a release. */
admin.put("/cities", async (c) => {
  const city = CityUpsert.safeParse(await c.req.json().catch(() => null));
  if (!city.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  await transaction(db, () => upsertCity(db, city.data));
  log.info("city saved", { requestId: c.get(Var.requestId), city: city.data.key, areas: city.data.areas.length });
  return c.body(null, 204);
});
