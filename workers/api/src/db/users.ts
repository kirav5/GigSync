import type { UserId } from "@gigsync/protocol";
import type { Db } from "./client.js";

/** The user a verified phone number belongs to, if it has signed in before. */
export async function userForPhone(db: Db, phoneHmac: string): Promise<UserId | undefined> {
  const { rows } = await db.query<{ user_id: UserId }>("SELECT user_id FROM phone_bindings WHERE phone_hmac = $1", [
    phoneHmac,
  ]);
  return rows[0]?.user_id;
}

/** Creates a user and binds their number's HMAC to it. Call inside a transaction with the device and session. */
export async function insertUser(db: Db, user: UserId, phoneHmac: string, at: Date): Promise<void> {
  await db.query("INSERT INTO users (user_id, created_at) VALUES ($1, $2)", [user, at]);
  await db.query("INSERT INTO phone_bindings (phone_hmac, user_id, verified_at) VALUES ($1, $2, $3)", [
    phoneHmac,
    user,
    at,
  ]);
}
