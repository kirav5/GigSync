import { log } from "@gigsync/core/log";
import { EstimateRequest, isEstimate } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { serveEstimate } from "../estimates/drivers.js";

/**
 * Rate estimates (ADR 0039, ADR 0041), behind the session middleware. Touches nothing a user owns: an estimate is the
 * same for everyone who asks, and a range from GigSync's prices is a group's, never one person's.
 */
export const estimates = new Hono<AppEnv>();

/** Paths under /v1/estimates. */
const Path = { estimate: "/" } as const;

const body = async (req: Request) => req.json().catch(() => null);

estimates.post(Path.estimate, async (c) => {
  const req = EstimateRequest.safeParse(await body(c.req.raw));
  if (!req.success) return c.json({ error: ApiError.badRequest }, 400);
  const result = await serveEstimate(c.get(Var.db), req.data, new Date());
  log.info("estimate served", {
    requestId: c.get(Var.requestId),
    trade: req.data.trade,
    drivers: req.data.drivers !== undefined,
    outcome: isEstimate(result) ? result.basis.kind : result.none,
    jobs: isEstimate(result) ? result.basis.gigsync_jobs : 0,
  });
  return c.json(result);
});
