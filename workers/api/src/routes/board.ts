import { log } from "@gigsync/core/log";
import { BoardProfile, BoardQuery, type BoardResult, UserId } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, USER_PARAM, Var } from "../context.js";
import { removeProfile, searchWorkers, upsertProfile, workerCard } from "../db/board.js";
import { transaction } from "../db/client.js";

/**
 * The job board, behind the session middleware: a worker publishes their own card; anyone signed in searches or reads
 * one worker's card. Every card is served with its record capped at the server's counts (ADR 0036).
 */
export const board = new Hono<AppEnv>();

const Path = { profile: "/profile", workers: "/workers", worker: `/workers/:${USER_PARAM}` } as const;

board.put(Path.profile, async (c) => {
  const profile = BoardProfile.safeParse(await c.req.json().catch(() => null));
  if (!profile.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  await transaction(db, () => upsertProfile(db, c.get(Var.user), profile.data, new Date()));
  log.info("board profile published", {
    requestId: c.get(Var.requestId),
    user: c.get(Var.user),
    trades: profile.data.trades.length,
  });
  // The card as others now see it: area rounded, record capped.
  const card = await workerCard(db, c.get(Var.user));
  if (!card) return c.json({ error: ApiError.notFound }, 404);
  return c.json(card);
});

board.delete(Path.profile, async (c) => {
  const removed = await removeProfile(c.get(Var.db), c.get(Var.user));
  log.info("board profile removed", { requestId: c.get(Var.requestId), user: c.get(Var.user), removed });
  return c.json({ removed });
});

board.get(Path.workers, async (c) => {
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

/** One worker's card as served, for a card that reached the phone sealed (an offer to work) and so went uncapped. */
board.get(Path.worker, async (c) => {
  const user = UserId.safeParse(c.req.param(USER_PARAM));
  if (!user.success) return c.json({ error: ApiError.badUserId }, 400);
  const card = await workerCard(c.get(Var.db), user.data);
  if (!card) return c.json({ error: ApiError.notFound }, 404);
  return c.json(card);
});
