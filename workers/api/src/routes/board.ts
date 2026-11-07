import { log } from "@gigsync/core/log";
import {
  BoardProfile,
  BoardQuery,
  type BoardResult,
  type BoardSkills,
  ListedRatesQuery,
  UserId,
} from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, USER_PARAM, Var } from "../context.js";
import { myCard, removeProfile, upsertProfile, workerCard } from "../db/board.js";
import { searchWorkers } from "../db/board-search.js";
import { transaction } from "../db/client.js";
import { listedRates } from "../db/listed-rates.js";
import { listSkills } from "../db/skills.js";

/**
 * The job board, behind the session middleware: a worker publishes their own card; anyone signed in searches or reads
 * one worker's card. Every card is served with the record the server computes from job records (ADR 0038).
 */
export const board = new Hono<AppEnv>();

const Path = {
  profile: "/profile",
  rates: "/rates",
  skills: "/skills",
  workers: "/workers",
  worker: `/workers/:${USER_PARAM}`,
} as const;

board.put(Path.profile, async (c) => {
  const profile = BoardProfile.safeParse(await c.req.json().catch(() => null));
  if (!profile.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  await transaction(db, () => upsertProfile(db, c.get(Var.user), profile.data, new Date()));
  log.info("board profile published", {
    requestId: c.get(Var.requestId),
    user: c.get(Var.user),
    trades: profile.data.trades.length,
    skills: profile.data.skills?.length ?? 0,
  });
  // The card as others now see it: area rounded, record computed.
  const card = await workerCard(db, c.get(Var.user));
  if (!card) return c.json({ error: ApiError.notFound }, 404);
  return c.json(card);
});

/** The caller's own card with their switch: a new phone refills its card from this (ADR 0037 §4). */
board.get(Path.profile, async (c) => {
  const card = await myCard(c.get(Var.db), c.get(Var.user));
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
    // A skill's key is not logged: it says what one household looked for (ADR 0047).
    trade: query.data.trade,
    bySkill: query.data.skill !== undefined || query.data.category !== undefined,
    radiusKm: query.data.radius_km,
    found: workers.length,
  });
  return c.json({ workers } satisfies BoardResult);
});

/** The board's skills, for a household's phone to match its owner's words against on the phone (ADR 0047 §4). */
board.get(Path.skills, async (c) => {
  const skills = await listSkills(c.get(Var.db));
  return c.json({ skills } satisfies BoardSkills);
});

/** What workers near a place list for a skill: a range from three up, which the budget question shows (ADR 0057). */
board.get(Path.rates, async (c) => {
  const query = ListedRatesQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: ApiError.badRequest }, 400);
  return c.json(await listedRates(c.get(Var.db), query.data));
});

/** One worker's card as served, for a card that reached the phone sealed (an offer to work) without the server's record. */
board.get(Path.worker, async (c) => {
  const user = UserId.safeParse(c.req.param(USER_PARAM));
  if (!user.success) return c.json({ error: ApiError.badUserId }, 400);
  const card = await workerCard(c.get(Var.db), user.data);
  if (!card) return c.json({ error: ApiError.notFound }, 404);
  return c.json(card);
});
