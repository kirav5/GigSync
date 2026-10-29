import { log } from "@gigsync/core/log";
import { DeviceProtocol } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { raiseProtocol } from "../db/devices.js";

/** The caller's own device, behind the session middleware. */
export const devices = new Hono<AppEnv>();

/**
 * A device registers its protocol only at sign-in, so a phone updated since would stay on the old number and never
 * be sent newer kinds. The app calls this once after an update; the number only goes up.
 */
devices.put("/me/protocol", async (c) => {
  const body = DeviceProtocol.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await raiseProtocol(c.get(Var.db), c.get(Var.device), c.get(Var.user), body.data.protocol);
  if (!found) return c.json({ error: ApiError.notFound }, 404);
  log.info("device protocol raised", { requestId: c.get(Var.requestId), protocol: body.data.protocol });
  return c.body(null, 204);
});
