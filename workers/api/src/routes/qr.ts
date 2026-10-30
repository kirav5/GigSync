import { log } from "@gigsync/core/log";
import { MyQrRequest, OfferRefusal, QR_LOOKUPS_PER_HOUR, QrCode, QrRole, type UserId } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, CODE_PARAM, Var } from "../context.js";
import { isListed } from "../db/board.js";
import { type Db, transaction } from "../db/client.js";
import { endLiveCode, insertCode, liveCode, personOf, saveOwner } from "../db/qr.js";
import { countLookup, offerCounts, recordOffer } from "../db/qr-offers.js";
import { LOOKUP_WINDOW_MS, newCode, OFFER_WINDOW_MS, offerRefusal } from "../qr/rules.js";

/**
 * Personal QR codes (ADR 0034), behind the session middleware: the owner gets or replaces their code; a scanner looks
 * one up; a worker who scanned a household's code offers to work for it. Lookups are capped per person, found or not.
 */
export const qr = new Hono<AppEnv>();

const Path = { me: "/me", replace: "/me/replace", code: `/:${CODE_PARAM}`, offer: `/:${CODE_PARAM}/offer` } as const;

const body = async (req: Request) => req.json().catch(() => null);
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Counts one lookup; false once the caller has used up this window's. */
async function mayLookUp(db: Db, user: UserId, now: Date): Promise<boolean> {
  return (await countLookup(db, user, now, ago(now, LOOKUP_WINDOW_MS))) <= QR_LOOKUPS_PER_HOUR;
}

/** The caller's live code, made on first ask; their role and first name are kept as they say now. */
qr.put(Path.me, async (c) => {
  const owner = MyQrRequest.safeParse(await body(c.req.raw));
  if (!owner.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  const mine = await transaction(db, async () => {
    await saveOwner(db, user, owner.data, now);
    return (await liveCode(db, user)) ?? insertCode(db, user, newCode(), now);
  });
  return c.json(mine);
});

/** A new code for the caller; the old one stops finding them at once. */
qr.post(Path.replace, async (c) => {
  const owner = MyQrRequest.safeParse(await body(c.req.raw));
  if (!owner.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  const mine = await transaction(db, async () => {
    await saveOwner(db, user, owner.data, now);
    await endLiveCode(db, user, now);
    return insertCode(db, user, newCode(), now);
  });
  log.info("qr code replaced", { requestId: c.get(Var.requestId), user });
  return c.json(mine);
});

qr.get(Path.code, async (c) => {
  const code = QrCode.safeParse(c.req.param(CODE_PARAM));
  if (!code.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  if (!(await mayLookUp(db, user, new Date()))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const person = await personOf(db, code.data);
  log.info("qr code looked up", { requestId: c.get(Var.requestId), user, found: !!person });
  if (!person) return c.json({ error: ApiError.notFound }, 404);
  return c.json(person);
});

/**
 * A worker with a card on the board offers to work for the household whose live code they scanned; the phone sends
 * the work_offer envelope right after. Counting and recording are two statements: two offers racing past a cap by one
 * is harmless, and the household's phone keeps one open offer per worker anyway.
 */
qr.post(Path.offer, async (c) => {
  const code = QrCode.safeParse(c.req.param(CODE_PARAM));
  if (!code.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  if (!(await mayLookUp(db, user, now))) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const [person, listed] = await Promise.all([personOf(db, code.data), isListed(db, user)]);
  if (!person) return c.json({ error: ApiError.notFound }, 404);
  if (person.role !== QrRole.enum.household || person.user === user)
    return c.json({ error: OfferRefusal.enum.not_household }, 403);
  if (!listed) return c.json({ error: OfferRefusal.enum.no_card }, 403);
  const refusal = offerRefusal(await offerCounts(db, user, person.user, code.data, ago(now, OFFER_WINDOW_MS)));
  if (refusal) return c.json({ error: refusal }, 429);
  await recordOffer(db, user, code.data, now);
  log.info("work offer taken", { requestId: c.get(Var.requestId), worker: user, household: person.user });
  return c.body(null, 204);
});
