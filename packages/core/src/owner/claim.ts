import { UserId } from "@gigsync/protocol";
import { log } from "../log.js";
import { PAYEE_KEY } from "../payments/payee.js";
import { Collection, type Storage } from "../ports.js";
import { OWNED_COLLECTIONS, ownedName } from "./storage.js";

/** The phone settings record saying the records from before owners were kept apart have been given out. */
export const CLAIM_KEY = "owner_claim";

/** Owner settings that lived among the phone's settings before owners were kept apart. */
const LEGACY_OWNER_SETTINGS = [PAYEE_KEY] as const;

interface Claim {
  owner: UserId;
  /** ISO time of the claim. */
  at: string;
}

/** The owner a record names itself (a memory document, a move), if it names one. */
function namedOwner(value: unknown): UserId | undefined {
  if (typeof value !== "object" || value === null || !("owner" in value)) return undefined;
  const parsed = UserId.safeParse(value.owner);
  return parsed.success ? parsed.data : undefined;
}

/** Moves one record to the collection `to` picks for it: written there first, so a failure never loses it. */
async function move(storage: Storage, from: string, id: string, to: (value: unknown) => string): Promise<number> {
  const value = await storage.get<unknown>(from, id);
  if (value === undefined) return 0;
  await storage.put(to(value), id, value);
  await storage.delete(from, id);
  return 1;
}

async function moveCollection(storage: Storage, collection: string, owner: UserId): Promise<number> {
  const ids = await storage.ids(collection);
  const moved = await Promise.all(
    ids.map((id) => move(storage, collection, id, (value) => ownedName(collection, namedOwner(value) ?? owner))),
  );
  return moved.reduce((sum, n) => sum + n, 0);
}

/**
 * Once per phone, on the first launch with someone signed in: the records written before owners were kept apart
 * carry no owner, and they were that person's to see anyway, so they become theirs. A record that names its own
 * owner (memory, a move) goes to that owner instead. Run again it does nothing, and a run cut short moves the rest
 * next time, since each record leaves the shared collection only once it is under its owner. Returns how many moved.
 */
export async function claimLegacyRecords(storage: Storage, owner: UserId, now: Date): Promise<number> {
  if (await storage.get<Claim>(Collection.settings, CLAIM_KEY)) return 0;
  const counts = await Promise.all([
    ...OWNED_COLLECTIONS.map((c) => moveCollection(storage, c, owner)),
    ...LEGACY_OWNER_SETTINGS.map((key) =>
      move(storage, Collection.settings, key, () => ownedName(Collection.ownerSettings, owner)),
    ),
  ]);
  await storage.put<Claim>(Collection.settings, CLAIM_KEY, { owner, at: now.toISOString() });
  const moved = counts.reduce((sum, n) => sum + n, 0);
  log.info("legacy records claimed", { moved });
  return moved;
}
