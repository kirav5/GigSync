import type {
  BoardProfile,
  DeviceId,
  Lang,
  TransferDownload,
  TransferId,
  TransferSlot,
  TransferUpload,
  UserId,
} from "@gigsync/protocol";

/**
 * workers/api's routes for moving to a new phone and refilling a card (ADR 0037 §3, §4). NewPhoneClient implements
 * them; tests fake them in memory.
 */
export interface TransferApi {
  /** Puts the sealed package in a slot that waits 15 minutes; replaces any slot the owner already had. */
  uploadTransfer(upload: TransferUpload): Promise<TransferSlot>;
  /** Takes the package out of the slot: one download, by the same owner, after which the slot is gone. */
  downloadTransfer(id: TransferId): Promise<TransferDownload>;
  /** Signs another of the owner's devices out for good: the old phone, once the new one holds everything. */
  revokeDevice(device: DeviceId): Promise<void>;
  /** The owner's own card as the board serves it; undefined when they have none on the board. */
  myCard(): Promise<BoardProfile | undefined>;
}

/** Why a move did not happen. The screen shows the matching `phone.problem_*` line. */
export const MoveProblem = {
  /** More than a slot takes, even without the chats. */
  too_big: "too_big",
  /** The scanned QR is not a move code (a personal QR, or something else). */
  not_move: "not_move",
  /** The code was used already, or never existed: the old phone makes a new one. */
  gone: "gone",
  /** The 15 minutes ran out. */
  expired: "expired",
  /** The code came from this same phone. */
  same_phone: "same_phone",
  /** The code is for another number than the one signed in here. */
  not_yours: "not_yours",
  /** The old phone runs a newer GigSync, whose records this one cannot read yet. */
  newer: "newer",
  /** The old phone's records did not arrive whole. */
  damaged: "damaged",
  /** The old phone's account is the other role (worker or household) than the one signed in here. */
  other_role: "other_role",
  /** Too many codes this hour. */
  too_many: "too_many",
} as const;
export type MoveProblem = (typeof MoveProblem)[keyof typeof MoveProblem];

/** A move step this phone will not take, or the server refused; `problem` says which. */
export class MoveError extends Error {
  constructor(readonly problem: MoveProblem) {
    super(`move refused: ${problem}`);
  }
}

/** One record as it moves: its id and its value, under its collection's name. */
export interface MovedRecord {
  id: string;
  value: unknown;
}

/** Collection name to its records. */
export type MovedRecords = Record<string, MovedRecord[]>;

/**
 * What the old phone seals for the new one: every record of one owner, the language they use, and which collections
 * were left behind to fit. `v` is the format's version: a newer phone reads older packages, an older one refuses a
 * newer package rather than guessing at it.
 */
export interface MovePackage {
  format: string;
  v: number;
  owner: UserId;
  /** ISO time the old phone made it. */
  made_at: string;
  lang?: Lang;
  records: MovedRecords;
  left_out: string[];
}
