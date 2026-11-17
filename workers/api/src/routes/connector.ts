import { BEARER_PREFIX, Header } from "@gigsync/core/http";
import { log, pii } from "@gigsync/core/log";
import { BoardQuery, type BoardResult, type BoardSkills } from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, Var } from "../context.js";
import { myCard } from "../db/board.js";
import { searchWorkers } from "../db/board-search.js";
import { connectorOwner, revokeConnectorSession } from "../db/connector-sessions.js";
import { listSkills } from "../db/skills.js";

/**
 * What a connected assistant may do (ADR 0068), by a connector token from `POST /v1/auth/connector`: search the board,
 * read its owner's own card and the skills list, and end its own token. Nothing here reads or sends mail: the assistant
 * holds no device keys. App session tokens are not taken here, nor connector tokens anywhere else.
 */
export const connector = new Hono<AppEnv & { Variables: { connectorToken: string } }>();

const Path = { workers: "/workers", card: "/card", skills: "/skills", session: "/session" } as const;
const TOKEN = "connectorToken";

connector.use("*", async (c, next) => {
  const header = c.req.header(Header.authorization);
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
  const user = token ? await connectorOwner(c.get(Var.db), token) : undefined;
  if (!token || !user) {
    log.warn("connector token rejected", { requestId: c.get(Var.requestId), token: pii(token ?? "") });
    return c.json({ error: ApiError.unauthorized }, 401);
  }
  c.set(Var.user, user);
  c.set(TOKEN, token);
  await next();
});

connector.get(Path.workers, async (c) => {
  const query = BoardQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: ApiError.badRequest }, 400);
  const workers = await searchWorkers(c.get(Var.db), query.data);
  log.info("connector searched", {
    requestId: c.get(Var.requestId),
    trade: query.data.trade,
    bySkill: query.data.skill !== undefined || query.data.category !== undefined,
    found: workers.length,
  });
  return c.json({ workers } satisfies BoardResult);
});

connector.get(Path.card, async (c) => {
  const card = await myCard(c.get(Var.db), c.get(Var.user));
  if (!card) return c.json({ error: ApiError.notFound }, 404);
  return c.json(card);
});

connector.get(Path.skills, async (c) => {
  const skills = await listSkills(c.get(Var.db));
  return c.json({ skills } satisfies BoardSkills);
});

connector.delete(Path.session, async (c) => {
  const revoked = await revokeConnectorSession(c.get(Var.db), c.get(TOKEN), new Date());
  log.info("connector signed out", { requestId: c.get(Var.requestId), user: c.get(Var.user) });
  return c.json({ revoked });
});
