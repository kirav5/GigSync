import { Collection, type Storage } from "../ports.js";

/** Collections of mentor records, each kept under the channel it travels on. */
const BY_CHANNEL = [
  Collection.mentorRequests,
  Collection.mentorAsks,
  Collection.mentorIntros,
  Collection.mentorEarly,
] as const;

/** Ids of the single documents in `Collection.mentorSettings`. */
export const SettingsDoc = { newcomer: "newcomer", choices: "choices" } as const;

/**
 * Wipes the owner's mentor records at sign-out: requests, introductions, the "I am a woman" answer, mentor choices and
 * the block list are not kept per owner, so the next person to sign in on a shared phone must not inherit them. Blocks
 * stay on the server, where they are tied to the account.
 */
export async function wipeMentors(storage: Storage): Promise<void> {
  const channels = await Promise.all(
    BY_CHANNEL.map(async (c) => ({ c, ids: (await storage.list<{ channel: string }>(c)).map((r) => r.channel) })),
  );
  const blocked = await storage.list<{ user: string }>(Collection.blocked);
  await Promise.all([
    ...channels.flatMap(({ c, ids }) => ids.map((id) => storage.delete(c, id))),
    ...blocked.map((b) => storage.delete(Collection.blocked, b.user)),
    ...Object.values(SettingsDoc).map((doc) => storage.delete(Collection.mentorSettings, doc)),
  ]);
}
