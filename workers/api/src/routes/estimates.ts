import { log } from "@gigsync/core/log";
import { EstimateRequest, isEstimate, SharedPrice } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { bucketOf, ShareOutcome, serveEstimate, sharePrice } from "../estimates/service.js";
import { quoteSourceFor } from "../estimates/source.js";

/**
 * Rate estimates (ADR 0030), behind the session middleware. Neither route touches anything a user owns: an estimate
 * is the same for everyone who asks, and a shared price is stored without its sender.
 */
export const estimates = new Hono<AppEnv>();

/** Paths under /v1/estimates. */
const Path = { estimate: "/", prices: "/prices" } as const;

const body = async (req: Request) => req.json().catch(() => null);

estimates.post(Path.estimate, async (c) => {
  const req = EstimateRequest.safeParse(await body(c.req.raw));
  if (!req.success) return c.json({ error: ApiError.badRequest }, 400);
  const ctx = { db: c.get(Var.db), source: quoteSourceFor(c.env), requestId: c.get(Var.requestId) };
  const result = await serveEstimate(ctx, req.data, new Date());
  log.info("estimate served", {
    requestId: c.get(Var.requestId),
    trade: req.data.trade,
    bucket: bucketOf(req.data),
    outcome: isEstimate(result) ? result.unit : result.none,
  });
  return c.json(result);
});

estimates.post(Path.prices, async (c) => {
  const price = SharedPrice.safeParse(await body(c.req.raw));
  if (!price.success) return c.json({ error: ApiError.badRequest }, 400);
  const outcome = await sharePrice(c.get(Var.db), c.get(Var.user), price.data, new Date());
  // The user is not logged with the trade: together they would say who shared what.
  log.info("price shared", { requestId: c.get(Var.requestId), trade: price.data.trade, outcome });
  if (outcome === ShareOutcome.badMonth) return c.json({ error: ApiError.badRequest }, 400);
  if (outcome === ShareOutcome.tooMany) return c.json({ error: ApiError.tooManyAttempts }, 429);
  return c.body(null, 204);
});
