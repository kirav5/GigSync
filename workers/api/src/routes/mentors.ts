import { log } from "@gigsync/core/log";
import {
  MatchRequest,
  type MatchResponse,
  MentorBlock,
  MentorListing,
  MentorReport,
  MentorVouch,
  type MyMentorListing,
} from "@gigsync/protocol";
import { Hono } from "hono";
import { ADMIN_HEADER, ApiError, type AppEnv, Var } from "../context.js";
import { sameSecret } from "../crypto.js";
import { transaction } from "../db/client.js";
import { block, report } from "../db/mentor-safety.js";
import { matchMentors, ownListing, removeListing, setVouch, upsertListing } from "../db/mentors.js";

/**
 * Mentors, behind the session middleware: a worker lists or unlists themselves; a newcomer matches, reports and
 * blocks. The server only filters by fixed rules; the newcomer picks, and contact goes through sealed envelopes.
 */
export const mentors = new Hono<AppEnv>();

/** Paths under /v1/mentors. */
const Path = { me: "/me", match: "/match", report: "/report", block: "/block", vouch: "/vouch" } as const;

const body = async (req: Request) => req.json().catch(() => null);

mentors.put(Path.me, async (c) => {
  const listing = MentorListing.safeParse(await body(c.req.raw));
  if (!listing.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  await transaction(db, () => upsertListing(db, user, listing.data, new Date()));
  const stored = await ownListing(db, user);
  if (!stored) throw new Error("mentor listing missing after upsert");
  log.info("mentor listed", { requestId: c.get(Var.requestId), user, slots: stored.open_slots, active: stored.active });
  return c.json({ listing: stored } satisfies MyMentorListing);
});

mentors.get(Path.me, async (c) => {
  const stored = await ownListing(c.get(Var.db), c.get(Var.user));
  if (!stored) return c.json({ error: ApiError.notFound }, 404);
  return c.json({ listing: stored } satisfies MyMentorListing);
});

mentors.delete(Path.me, async (c) => {
  const removed = await removeListing(c.get(Var.db), c.get(Var.user));
  log.info("mentor unlisted", { requestId: c.get(Var.requestId), user: c.get(Var.user), removed });
  return c.body(null, 204);
});

mentors.post(Path.match, async (c) => {
  const query = MatchRequest.safeParse(await body(c.req.raw));
  if (!query.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await matchMentors(c.get(Var.db), c.get(Var.user), query.data);
  log.info("mentors matched", {
    requestId: c.get(Var.requestId),
    city: query.data.city,
    trade: query.data.trade,
    found: found.length,
  });
  return c.json({ mentors: found } satisfies MatchResponse);
});

mentors.post(Path.report, async (c) => {
  const r = MentorReport.safeParse(await body(c.req.raw));
  const user = c.get(Var.user);
  if (!r.success || r.data.user === user) return c.json({ error: ApiError.badRequest }, 400);
  if (!(await report(c.get(Var.db), user, r.data.user, r.data.reason, new Date()))) {
    return c.json({ error: ApiError.notFound }, 404);
  }
  log.info("mentor reported", { requestId: c.get(Var.requestId), reported: r.data.user, reason: r.data.reason });
  return c.body(null, 204);
});

mentors.post(Path.block, async (c) => {
  const b = MentorBlock.safeParse(await body(c.req.raw));
  const user = c.get(Var.user);
  if (!b.success || b.data.user === user) return c.json({ error: ApiError.badRequest }, 400);
  if (!(await block(c.get(Var.db), user, b.data.user, new Date()))) return c.json({ error: ApiError.notFound }, 404);
  log.info("mentor pair blocked", { requestId: c.get(Var.requestId) });
  return c.body(null, 204);
});

/** Admin only: a union or NGO's vouch, set by hand where one exists. No UI; nobody is admin while ADMIN_KEY is unset. */
mentors.post(Path.vouch, async (c) => {
  const key = c.env.ADMIN_KEY;
  const given = c.req.header(ADMIN_HEADER);
  if (!key || !given || !(await sameSecret(given, key))) {
    log.warn("admin key rejected", { requestId: c.get(Var.requestId), user: c.get(Var.user) });
    return c.json({ error: ApiError.forbidden }, 403);
  }
  const v = MentorVouch.safeParse(await body(c.req.raw));
  if (!v.success) return c.json({ error: ApiError.badRequest }, 400);
  if (!(await setVouch(c.get(Var.db), v.data.user, v.data.vouched_by))) {
    return c.json({ error: ApiError.notFound }, 404);
  }
  log.info("mentor vouch set", { requestId: c.get(Var.requestId), mentor: v.data.user, vouched: !!v.data.vouched_by });
  return c.body(null, 204);
});
