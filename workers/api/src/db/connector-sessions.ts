import type { UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import type { Db } from "./client.js";
import { SESSION_DAYS } from "./sessions.js";

/** The one status that may use the API, as for app sessions. */
const ACTIVE = "active";

/** A new connector token for this owner (ADR 0068). */
export async function insertConnectorSession(db: Db, user: UserId, at: Date): Promise<string> {
  const token = `con_${ulid()}`;
  await db.query("INSERT INTO connector_sessions (token, user_id, created_at) VALUES ($1, $2, $3)", [token, user, at]);
  return token;
}

/** Whose a connector token is, or undefined when it is unknown, revoked, expired, or the account is not active. */
export async function connectorOwner(db: Db, token: string): Promise<UserId | undefined> {
  const { rows } = await db.query<{ user_id: UserId }>(
    `SELECT c.user_id FROM connector_sessions c
     JOIN users u ON u.user_id = c.user_id AND u.status = $3
     WHERE c.token = $1 AND c.revoked_at IS NULL AND c.created_at > now() - make_interval(days => $2)`,
    [token, SESSION_DAYS, ACTIVE],
  );
  return rows[0]?.user_id;
}

/** Ends one connector token; true when it was live. */
export async function revokeConnectorSession(db: Db, token: string, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    "UPDATE connector_sessions SET revoked_at = $2 WHERE token = $1 AND revoked_at IS NULL",
    [token, at],
  );
  return (rowCount ?? 0) > 0;
}
