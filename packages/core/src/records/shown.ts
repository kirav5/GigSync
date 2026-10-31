import { type BoardProfile, MIN_RATED, type WorkerRecord } from "@gigsync/protocol";

/**
 * How a worker's record shows on a card (ADR 0036, 0038). The server computes it from the job records both phones
 * attested; a phone only shows what a card served, never numbers of its own.
 */

/** The average is worth showing: enough households rated for one opinion not to be the whole of it. */
export function ratingShown(record: WorkerRecord): record is WorkerRecord & { average: number } {
  return record.average !== undefined && record.rated >= MIN_RATED;
}

/** The record a served card shows: absent when its worker hid it or has none, never one its worker chose to hide. */
export function shownRecord(card: Pick<BoardProfile, "record" | "show_record">): WorkerRecord | undefined {
  return card.show_record === false ? undefined : card.record;
}

/**
 * A card that reached this phone sealed (an offer to work), without any record it carried: only the server's record
 * is ever shown, so the board's is read instead.
 */
export function withoutRecord(card: BoardProfile): BoardProfile {
  const kept = { ...card };
  delete kept.record;
  delete kept.show_record;
  return kept;
}
