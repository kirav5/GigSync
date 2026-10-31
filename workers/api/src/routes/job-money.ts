import { log } from "@gigsync/core/log";
import { EngagementId, PaymentId, PaymentReport, RecordRefusal, STARS_PER_HOUR, StarsReport } from "@gigsync/protocol";
import { type Context, Hono } from "hono";
import { ApiError, type AppEnv, ENGAGEMENT_PARAM, PAYMENT_PARAM, Var } from "../context.js";
import { addPayment, confirmPayment, paymentOf } from "../db/job-payments.js";
import { type Party, partyOf, setStars } from "../db/job-records.js";
import { countHit, RateAction } from "../db/rate-windows.js";
import { requireConsent } from "../middleware/consent.js";
import { isCancelled, isHousehold, isWorker, samePayment } from "../records/rules.js";

/**
 * Payments and stars on a stored job (ADR 0038 §2), behind the session middleware and the notice: a payment counts
 * when the worker, who received it, reports or confirms it; stars come from the household only and a later one
 * replaces the last.
 */
export const jobMoney = new Hono<AppEnv>();

const Path = {
  payments: `/:${ENGAGEMENT_PARAM}/payments`,
  confirm: `/:${ENGAGEMENT_PARAM}/payments/:${PAYMENT_PARAM}/confirm`,
  stars: `/:${ENGAGEMENT_PARAM}/stars`,
} as const;

const HOUR_MS = 3600_000;
const body = async (req: Request) => req.json().catch(() => null);

/** The caller's side of the job in the path, or the response that refuses them. */
async function partyIn(c: Context<AppEnv>): Promise<{ engagement: EngagementId; party: Party } | Response> {
  const engagement = EngagementId.safeParse(c.req.param(ENGAGEMENT_PARAM));
  if (!engagement.success) return c.json({ error: ApiError.badRequest }, 400);
  const party = await partyOf(c.get(Var.db), engagement.data, c.get(Var.user));
  if (!party) return c.json({ error: ApiError.notFound }, 404);
  if (isCancelled(party)) return c.json({ error: RecordRefusal.enum.wrong_status }, 409);
  return { engagement: engagement.data, party };
}

// Per route, not `use("*")`: this app shares its mount point with jobRecords, whose export needs no consent.
jobMoney.post(Path.payments, requireConsent, async (c) => {
  const report = PaymentReport.safeParse(await body(c.req.raw));
  if (!report.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await partyIn(c);
  if (found instanceof Response) return found;
  const db = c.get(Var.db);
  const { engagement, party } = found;
  const added = await addPayment(db, engagement, report.data, party.side, isWorker(party), new Date());
  if (added) {
    log.info("job payment recorded", { requestId: c.get(Var.requestId), engagement, confirmed: added.confirmed });
    return c.json(added, 201);
  }
  // The id is taken: a retry of the same payment answers as before; anything else is a different payment.
  const stored = await paymentOf(db, report.data.payment);
  if (stored?.engagement === engagement && samePayment(stored.payment, report.data)) return c.json(stored.payment, 201);
  return c.json({ error: RecordRefusal.enum.record_differs }, 409);
});

jobMoney.post(Path.confirm, requireConsent, async (c) => {
  const payment = PaymentId.safeParse(c.req.param(PAYMENT_PARAM));
  if (!payment.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await partyIn(c);
  if (found instanceof Response) return found;
  if (!isWorker(found.party)) return c.json({ error: RecordRefusal.enum.workers_only }, 403);
  const db = c.get(Var.db);
  const stored = await paymentOf(db, payment.data);
  if (stored?.engagement !== found.engagement) return c.json({ error: ApiError.notFound }, 404);
  const confirmed = await confirmPayment(db, payment.data, new Date());
  if (!confirmed) return c.json({ error: ApiError.notFound }, 404);
  log.info("job payment confirmed", { requestId: c.get(Var.requestId), engagement: found.engagement });
  return c.json(confirmed);
});

jobMoney.put(Path.stars, requireConsent, async (c) => {
  const report = StarsReport.safeParse(await body(c.req.raw));
  if (!report.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await partyIn(c);
  if (found instanceof Response) return found;
  if (!isHousehold(found.party)) return c.json({ error: RecordRefusal.enum.households_only }, 403);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  if ((await countHit(db, user, RateAction.stars, now, new Date(now.getTime() - HOUR_MS))) > STARS_PER_HOUR)
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  await setStars(db, found.engagement, report.data.stars, now);
  log.info("job stars given", { requestId: c.get(Var.requestId), engagement: found.engagement });
  return c.body(null, 204);
});
