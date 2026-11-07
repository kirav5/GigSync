import { FindCount } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { countFindEvent } from "../db/find-counts.js";

/** Find's own routes. A count carries no user and no words, and the session only keeps strangers out (ADR 0060). */
export const find = new Hono<AppEnv>();

find.post("/count", async (c) => {
  const body = FindCount.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  await countFindEvent(c.get(Var.db), body.data.event);
  return c.body(null, 204);
});
