import { canonicalJson } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { MovedRecords } from "./types.js";

/** One record on its way in, where it goes. */
export interface IncomingRecord {
  collection: string;
  id: string;
  value: unknown;
}

/**
 * How the old phone's records meet what this phone has: new ones are added, identical ones need nothing, and ones that
 * differ on the two phones are conflicts, which only the owner may settle: this phone's records are never overwritten
 * without asking.
 */
export interface MergePlan {
  add: IncomingRecord[];
  conflicts: IncomingRecord[];
  same: number;
}

/** What the owner chose for records that differ on the two phones. */
export const MergeChoice = { keepMine: "keep_mine", takeTheirs: "take_theirs" } as const;
export type MergeChoice = (typeof MergeChoice)[keyof typeof MergeChoice];

/**
 * A job this phone only refilled from the owner's record on GigSync: the old phone's full copy (with its words and
 * messages) simply replaces it, since the refill was only ever a stand-in for it.
 */
const standIn = (collection: string, mine: unknown): boolean =>
  collection === Collection.jobs && typeof mine === "object" && mine !== null && "restored" in mine;

/** Compares the old phone's records with this phone's, record by record, by collection and id. */
export async function planMerge(storage: Storage, records: MovedRecords): Promise<MergePlan> {
  const incoming = Object.entries(records).flatMap(([collection, list]) =>
    list.map((r) => ({ collection, id: r.id, value: r.value })),
  );
  const existing = await Promise.all(incoming.map((r) => storage.get<unknown>(r.collection, r.id)));
  const plan: MergePlan = { add: [], conflicts: [], same: 0 };
  incoming.forEach((record, i) => {
    const mine = existing[i];
    if (mine === undefined || standIn(record.collection, mine)) plan.add.push(record);
    else if (canonicalJson(mine) === canonicalJson(record.value)) plan.same += 1;
    else plan.conflicts.push(record);
  });
  return plan;
}

/** Writes the plan: every new record, and the conflicting ones only when the owner chose the old phone's. */
export async function applyMerge(storage: Storage, plan: MergePlan, choice: MergeChoice): Promise<number> {
  const writes = choice === MergeChoice.takeTheirs ? [...plan.add, ...plan.conflicts] : plan.add;
  await Promise.all(writes.map((r) => storage.put(r.collection, r.id, r.value)));
  return writes.length;
}
