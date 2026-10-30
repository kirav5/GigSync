import { type BoardProfile, MIN_RATED, roundAverage, type WorkerRecord } from "@gigsync/protocol";
import { doneWork } from "../payments/passbook.js";
import type { JobRecord } from "./store.js";

/** Hired again: a household with at least this many finished jobs from the same worker. */
const CAME_BACK_JOBS = 2;

/**
 * What the card carries of the worker's record (ADR 0036): the numbers with "show" on, or only "show" off, so the
 * numbers stay on the phone when the worker hides them.
 */
export type CardRecord = Required<Pick<BoardProfile, "show_record">> & Pick<BoardProfile, "record">;

/**
 * The worker's record from this phone's own jobs: finished work as the worker on terms both sides signed, how many of
 * those jobs the household rated and the average of their stars, and how many households hired them again. The server
 * caps each count at what it saw delivered.
 */
export function workerRecord(jobs: readonly JobRecord[]): WorkerRecord {
  const done = jobs.filter(doneWork);
  const stars = done.flatMap((r) => (r.review ? [r.review.stars] : []));
  const perHousehold = new Map<string, number>();
  for (const r of done)
    perHousehold.set(r.engagement.counterpart, (perHousehold.get(r.engagement.counterpart) ?? 0) + 1);
  const came_back = [...perHousehold.values()].filter((n) => n >= CAME_BACK_JOBS).length;
  const record: WorkerRecord = { jobs: done.length, rated: stars.length, came_back };
  if (stars.length === 0) return record;
  return { ...record, average: roundAverage(stars.reduce((a, b) => a + b, 0) / stars.length) };
}

/** The record as the card carries it: all of it, or none when the worker hid it (never single ratings). */
export function cardRecord(record: WorkerRecord, shown: boolean): CardRecord {
  return shown ? { record, show_record: true } : { show_record: false };
}

/** The average is worth showing: enough households rated for one opinion not to be the whole of it. */
export function ratingShown(record: WorkerRecord): record is WorkerRecord & { average: number } {
  return record.average !== undefined && record.rated >= MIN_RATED;
}

/**
 * The record a card shows: a served card's (capped by the server, and absent when its worker hid it or has none
 * counted), never one its worker chose to hide.
 */
export function shownRecord(card: Pick<BoardProfile, "record" | "show_record">): WorkerRecord | undefined {
  return card.show_record === false ? undefined : card.record;
}

/**
 * A card that reached this phone sealed (an offer to work), without the record it carried: only the server can cap a
 * record, so a sealed one is never shown; the board's served record is read instead.
 */
export function withoutRecord(card: BoardProfile): BoardProfile {
  const kept = { ...card };
  delete kept.record;
  delete kept.show_record;
  return kept;
}

const sameNumbers = (a: WorkerRecord | undefined, b: WorkerRecord | undefined): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.jobs === b.jobs &&
    a.rated === b.rated &&
    a.average === b.average &&
    a.came_back === b.came_back);

/** The same record, so publishing again would change nothing on the board. */
export function sameRecord(a: CardRecord | undefined, b: CardRecord | undefined): boolean {
  if (!a || !b) return a === b;
  return a.show_record === b.show_record && sameNumbers(a.record, b.record);
}
