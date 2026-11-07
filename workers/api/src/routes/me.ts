import { log } from "@gigsync/core/log";
import { Hono } from "hono";
import { type AppEnv, Var } from "../context.js";
import { transaction } from "../db/client.js";
import { revokeDevice } from "../db/devices.js";
import { deleteRecords } from "../db/record-deletion.js";

/** The caller's own data, behind the session middleware. */
export const me = new Hono<AppEnv>();

/** Deletes the caller's job records on request (ADR 0038 §5); see deleteRecords for what stays on the other side. */
me.delete("/records", async (c) => {
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const out = await transaction(db, () => deleteRecords(db, user, new Date()));
  log.info("job records deleted", { requestId: c.get(Var.requestId), user, ...out });
  return c.json(out);
});

/**
 * Sign-out: this phone's device and sessions are revoked, so nobody seals to it and its token stops working. Unlike
 * `DELETE /v1/devices/:device`, which revokes another of the caller's devices, this is the calling one.
 */
me.post("/signout", async (c) => {
  const db = c.get(Var.db);
  await transaction(db, () => revokeDevice(db, c.get(Var.user), c.get(Var.device), new Date()));
  log.info("signed out", { requestId: c.get(Var.requestId), user: c.get(Var.user), device: c.get(Var.device) });
  return c.body(null, 204);
});
