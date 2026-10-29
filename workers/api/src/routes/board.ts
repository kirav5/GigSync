import { log } from "@gigsync/core/log";
import { BoardProfile, BoardQuery, type BoardResult } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { removeProfile, roundArea, searchWorkers, upsertProfile } from "../db/board.js";
import { transaction } from "../db/client.js";

/** The job board, behind the session middleware: a worker publishes their own card; anyone signed in searches. */
export const board = new Hono<AppEnv>();

board.put("/profile", async (c) => {
  const profile = BoardProfile.safeParse(await c.req.json().catch(() => null));
  if (!profile.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  await transaction(db, () => upsertProfile(db, c.get(Var.user), profile.data, new Date()));
  log.info("board profile published", {
    requestId: c.get(Var.requestId),
    user: c.get(Var.user),
    trades: profile.data.trades.length,
  });
  const area = { lat: roundArea(profile.data.area.lat), lon: roundArea(profile.data.area.lon) };
  return c.json({ ...profile.data, area });
});

board.delete("/profile", async (c) => {
  const removed = await removeProfile(c.get(Var.db), c.get(Var.user));
  log.info("board profile removed", { requestId: c.get(Var.requestId), user: c.get(Var.user), removed });
  return c.json({ removed });
});

board.get("/workers", async (c) => {
  const query = BoardQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: ApiError.badRequest }, 400);
  const workers = await searchWorkers(c.get(Var.db), query.data);
  log.info("board searched", {
    requestId: c.get(Var.requestId),
    trade: query.data.trade,
    radiusKm: query.data.radius_km,
    found: workers.length,
  });
  return c.json({ workers } satisfies BoardResult);
});
