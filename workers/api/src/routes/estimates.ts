import { log } from "@gigsync/core/log";
import { EstimateRequest, isEstimate } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { bucketOf, serveEstimate } from "../estimates/service.js";
import { quoteSourceFor } from "../estimates/source.js";

/**
 * Rate estimates (ADR 0030, ADR 0039), behind the session middleware. Touches nothing a user owns: an estimate is the
 * same for everyone who asks, and a range from GigSync's prices is a group's, never one person's.
 */
export const estimates = new Hono<AppEnv>();

/** Paths under /v1/estimates. */
const Path = { estimate: "/" } as const;

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
    outcome: isEstimate(result) ? result.basis.kind : result.none,
    jobs: isEstimate(result) ? result.basis.gigsync_jobs : 0,
  });
  return c.json(result);
});
