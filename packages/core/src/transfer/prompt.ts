import type { DeviceId, UserId } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";

/** Collections that show an owner has used GigSync on this phone already: then there is nothing to move into it. */
const HISTORY: readonly string[] = [
  Collection.jobs,
  Collection.engagements,
  Collection.payments,
  Collection.chat,
  Collection.findChat,
];

/**
 * The phone settings record saying an owner was offered the move after signing in. Kept per phone, not among the
 * owner's records, so it never travels in a move (where both phones' copies would differ and ask the owner).
 */
const promptKey = (owner: UserId) => `move_prompt:${owner}`;

/**
 * Whether the owner has any history on this phone. `storage` is their view of it. Jobs only refilled from their record
 * on GigSync do not count: they stand in for the old phone's, which the move would bring with their words.
 */
export async function hasHistory(storage: Storage): Promise<boolean> {
  const used = await Promise.all(
    HISTORY.map(async (c) =>
      c === Collection.jobs
        ? (await storage.list<{ restored?: unknown }>(c)).some((job) => job.restored === undefined)
        : (await storage.ids(c)).length > 0,
    ),
  );
  return used.some(Boolean);
}

/** What decides the prompt besides this phone's records: this device, the owner's other devices, a waiting link. */
export interface PromptContext {
  /** This phone's device. */
  me: DeviceId;
  /** The owner's active devices, as the directory lists them; asked only when everything else says yes. */
  devices: () => Promise<readonly DeviceId[]>;
  /** A QR link (or another deep link) opened before sign-in is waiting to be shown: it comes first. */
  linkWaiting: boolean;
}

/**
 * Whether to ask "Moving from another phone?" after sign-in: once per owner per phone, only while the owner has nothing
 * here yet, only when another of their devices is still active (someone new has no old phone to move from), and never
 * over a link they opened to get here. `storage` is the owner's view of the phone, through which the phone's settings
 * pass unchanged. Settings offers the scan at any time regardless.
 */
export async function movePromptDue(storage: Storage, owner: UserId, ctx: PromptContext): Promise<boolean> {
  if (ctx.linkWaiting) return false;
  if (await storage.get(Collection.settings, promptKey(owner))) return false;
  if (await hasHistory(storage)) return false;
  return (await ctx.devices()).some((device) => device !== ctx.me);
}

/** The owner answered the prompt (scanned or said no): it is not asked again on this phone. */
export function movePromptAnswered(storage: Storage, owner: UserId, now: Date): Promise<void> {
  return storage.put(Collection.settings, promptKey(owner), { at: now.toISOString() });
}
