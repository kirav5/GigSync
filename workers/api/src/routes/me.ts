import { log } from "@gigsync/core/log";
import { Hono } from "hono";
import { type AppEnv, Var } from "../context.js";
import { transaction } from "../db/client.js";
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
