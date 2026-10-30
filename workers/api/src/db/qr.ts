import { type MyQr, type MyQrRequest, type QrPerson, QrRole, type UserId } from "@gigsync/protocol";
import { CARD_COLUMNS, type CardRow, cardOf } from "./board.js";
import type { Db } from "./client.js";

/** Records what the owner's QR shows: their role and first name. Call in the transaction that hands out the code. */
export async function saveOwner(db: Db, user: UserId, owner: MyQrRequest, at: Date): Promise<void> {
  await db.query(
    `INSERT INTO qr_owners (user_id, role, first_name, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET role = excluded.role, first_name = excluded.first_name,
       updated_at = excluded.updated_at`,
    [user, owner.role, owner.first_name, at],
  );
}

interface CodeRow {
  code: string;
  created_at: Date;
}

const myQr = (r: CodeRow): MyQr => ({ code: r.code, created_at: r.created_at.toISOString() });

/** The owner's live code, or undefined when they have none (never asked for one, or between replace and insert). */
export async function liveCode(db: Db, user: UserId): Promise<MyQr | undefined> {
  const { rows } = await db.query<CodeRow>(
    "SELECT code, created_at FROM qr_codes WHERE user_id = $1 AND replaced_at IS NULL",
    [user],
  );
  const [r] = rows;
  return r && myQr(r);
}

/**
 * The owner's live code, made on first ask, in one round trip: records their role and first name (only when changed),
 * then returns the live code or inserts `code` as it. Undefined only when a concurrent first ask won the insert; the
 * caller then reads the code that one made.
 */
export async function ownCode(
  db: Db,
  user: UserId,
  owner: MyQrRequest,
  code: string,
  at: Date,
): Promise<MyQr | undefined> {
  const { rows } = await db.query<CodeRow>(
    `WITH owner AS (
       INSERT INTO qr_owners (user_id, role, first_name, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET role = excluded.role, first_name = excluded.first_name,
         updated_at = excluded.updated_at
       WHERE qr_owners.role <> excluded.role OR qr_owners.first_name <> excluded.first_name
       RETURNING user_id
     ), live AS (
       SELECT code, created_at FROM qr_codes WHERE user_id = $1 AND replaced_at IS NULL
     ), made AS (
       INSERT INTO qr_codes (code, user_id, created_at)
       SELECT $5, $1, $4 WHERE NOT EXISTS (SELECT 1 FROM live)
       ON CONFLICT DO NOTHING
       RETURNING code, created_at
     )
     SELECT code, created_at FROM live UNION ALL SELECT code, created_at FROM made LIMIT 1`,
    [user, owner.role, owner.first_name, at, code],
  );
  const [r] = rows;
  return r && myQr(r);
}

/** Ends the owner's live code, if any. Call in the transaction that inserts the next one. */
export async function endLiveCode(db: Db, user: UserId, at: Date): Promise<void> {
  await db.query("UPDATE qr_codes SET replaced_at = $2 WHERE user_id = $1 AND replaced_at IS NULL", [user, at]);
}

/** Makes `code` the owner's live code. The unique index refuses a second live code for one owner. */
export async function insertCode(db: Db, user: UserId, code: string, at: Date): Promise<MyQr> {
  const { rows } = await db.query<CodeRow>(
    "INSERT INTO qr_codes (code, user_id, created_at) VALUES ($1, $2, $3) RETURNING code, created_at",
    [code, user, at],
  );
  const [r] = rows;
  if (!r) throw new Error("qr code insert returned no row");
  return myQr(r);
}

interface PersonRow extends Partial<CardRow> {
  user_id: UserId;
  role: QrRole;
  first_name: string;
  has_card: boolean;
}

const hasCard = (r: PersonRow): r is PersonRow & CardRow => r.has_card;

/**
 * Who a live code belongs to, as a scanner sees them, or undefined for a code that never existed, was replaced, or
 * belongs to an account that is not active. A household shows its first name only; a worker also their board card.
 */
export async function personOf(db: Db, code: string): Promise<QrPerson | undefined> {
  const { rows } = await db.query<PersonRow>(
    `SELECT o.user_id, o.role, o.first_name, p.user_id IS NOT NULL AS has_card, ${CARD_COLUMNS}
     FROM qr_codes c
     JOIN qr_owners o ON o.user_id = c.user_id
     JOIN users u ON u.user_id = c.user_id AND u.status = 'active'
     LEFT JOIN worker_profiles p ON p.user_id = c.user_id AND o.role = $2
     WHERE c.code = $1 AND c.replaced_at IS NULL`,
    [code, QrRole.enum.worker],
  );
  const [r] = rows;
  if (!r) return undefined;
  if (r.role === QrRole.enum.household) return { role: r.role, user: r.user_id, first_name: r.first_name };
  const card = hasCard(r) ? cardOf(r) : null;
  return { role: QrRole.enum.worker, user: r.user_id, first_name: r.first_name, card };
}
