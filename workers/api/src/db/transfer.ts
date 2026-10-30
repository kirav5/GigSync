import type { DeviceId, TransferId, TransferSlot, UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** A slot as created: who uploaded it, from which device, and until when it waits. */
export interface NewSlot {
  id: TransferId;
  user: UserId;
  device: DeviceId;
  ciphertext: string;
  at: Date;
  expiresAt: Date;
}

/** Stores the caller's slot, replacing any slot they had: one per user. */
export async function putSlot(db: Db, s: NewSlot): Promise<TransferSlot> {
  await db.query(
    `INSERT INTO transfer_slots (slot_id, user_id, device_id, ciphertext, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET slot_id = excluded.slot_id, device_id = excluded.device_id,
       ciphertext = excluded.ciphertext, created_at = excluded.created_at, expires_at = excluded.expires_at`,
    [s.id, s.user, s.device, s.ciphertext, s.at, s.expiresAt],
  );
  return { id: s.id, expires_at: s.expiresAt.toISOString() };
}

/** A slot as taken by its download. */
export interface TakenSlot {
  ciphertext: string;
  device_id: DeviceId;
  expires_at: Date;
}

/**
 * Takes `user`'s slot `id` out of the table in one statement, so it can be downloaded only once even by two racing
 * requests. Undefined when there is none or it is someone else's; an expired slot is returned (and so deleted) too,
 * for the caller to refuse.
 */
export async function takeSlot(db: Db, id: TransferId, user: UserId): Promise<TakenSlot | undefined> {
  const { rows } = await db.query<TakenSlot>(
    "DELETE FROM transfer_slots WHERE slot_id = $1 AND user_id = $2 RETURNING ciphertext, device_id, expires_at",
    [id, user],
  );
  return rows[0];
}

/** Deletes every slot past its expiry; returns how many. Run on each create and download. */
export async function purgeExpired(db: Db, now: Date): Promise<number> {
  const { rowCount } = await db.query("DELETE FROM transfer_slots WHERE expires_at <= $1", [now]);
  return rowCount ?? 0;
}
