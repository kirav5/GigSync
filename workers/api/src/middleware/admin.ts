import { log } from "@gigsync/core/log";
import type { MiddlewareHandler } from "hono";
import { ADMIN_HEADER, ApiError, type AppEnv, Var } from "../context.js";
import { sameSecret } from "../crypto.js";

/** Admin-only routes: the admin key in ADMIN_HEADER, compared in constant time. Nobody is admin while ADMIN_KEY is unset. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const key = c.env.ADMIN_KEY;
  const given = c.req.header(ADMIN_HEADER);
  if (!key || !given || !(await sameSecret(given, key))) {
    log.warn("admin key rejected", { requestId: c.get(Var.requestId), user: c.get(Var.user) });
    return c.json({ error: ApiError.forbidden }, 403);
  }
  await next();
};
