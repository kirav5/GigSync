import { Collection, type Storage } from "../ports.js";
import { type CardRecord, cardRecord, sameRecord, workerRecord } from "./card-record.js";
import { type JobRecord, JobStore } from "./store.js";

/** The owner's Privacy choice "Show my record on my card", in their own settings. */
const SHOW_KEY = "show_record";
/** The record last put on the board with the card, so it is published again only when it changes. */
const PUBLISHED_KEY = "card_record";

/** Whether the worker shows their record on their card: yes until they turn it off. */
export async function showsRecord(storage: Storage): Promise<boolean> {
  return (await storage.get<unknown>(Collection.ownerSettings, SHOW_KEY)) !== false;
}

export function setShowsRecord(storage: Storage, show: boolean): Promise<void> {
  return storage.put(Collection.ownerSettings, SHOW_KEY, show);
}

/** The record as this phone would put it on the board now: from its own jobs and the owner's choice. */
export async function myCardRecord(storage: Storage, jobs?: readonly JobRecord[]): Promise<CardRecord> {
  const [shown, all] = await Promise.all([showsRecord(storage), jobs ?? new JobStore(storage).jobs()]);
  return cardRecord(workerRecord(all), shown);
}

/** The record to put on the board with the card now, or undefined when the board has it already. */
export async function recordDue(storage: Storage, jobs: readonly JobRecord[]): Promise<CardRecord | undefined> {
  const [record, published] = await Promise.all([
    myCardRecord(storage, jobs),
    storage.get<CardRecord>(Collection.ownerSettings, PUBLISHED_KEY),
  ]);
  return sameRecord(published, record) ? undefined : record;
}

/** The board took the card with this record. */
export function keepPublishedRecord(storage: Storage, record: CardRecord): Promise<void> {
  return storage.put(Collection.ownerSettings, PUBLISHED_KEY, record);
}
