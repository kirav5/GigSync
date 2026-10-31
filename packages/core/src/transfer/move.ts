import {
  BoxError,
  fromBase64,
  fromBase64Url,
  lockBox,
  newBoxKey,
  openBox,
  toBase64,
  toBase64Url,
} from "@gigsync/crypto";
import { type DeviceId, type Lang, TRANSFER_MAX_CHARS, type UserId } from "@gigsync/protocol";
import { HttpError } from "../net/api.js";
import { Collection, type Storage } from "../ports.js";
import { moveCode, readMoveCode } from "./code.js";
import { collectRecords, MOVE_FORMAT, packMove, readPackage, recordCount } from "./pack.js";
import { MoveError, type MovePackage, MoveProblem, type TransferApi } from "./types.js";

/** What a box of one owner's records is for, authenticated with it: opened for anyone else, it fails. */
export const moveContext = (owner: UserId): string => `${MOVE_FORMAT}:${owner}`;

const Status = { notFound: 404, gone: 410, tooLarge: 413, tooMany: 429 } as const;
const PROBLEM_BY_STATUS: Readonly<Record<number, MoveProblem>> = {
  [Status.notFound]: MoveProblem.gone,
  [Status.gone]: MoveProblem.expired,
  [Status.tooLarge]: MoveProblem.too_big,
  [Status.tooMany]: MoveProblem.too_many,
};

/** The server's answer to a transfer call as a MoveError when it is one the owner should be told about. */
export function moveProblemOf(err: unknown): unknown {
  if (!(err instanceof HttpError)) return err;
  const problem = PROBLEM_BY_STATUS[err.status];
  return problem ? new MoveError(problem) : err;
}

const mapped = (err: unknown): never => {
  throw moveProblemOf(err);
};

/** What the old phone shows: the QR's text, until when it works, and what did not go into it. */
export interface MoveOffer {
  text: string;
  /** ISO time the slot stops working. */
  expires_at: string;
  /** Collections left behind to fit (LEAVE_FIRST). */
  left_out: string[];
  /** How many records went in. */
  records: number;
  /** Envelopes still queued on this phone, which cannot move (DEVICE_BOUND). */
  unsent: number;
}

interface OfferInput {
  owner: UserId;
  lang?: Lang;
  now: Date;
  /** The slot's limit; the protocol's unless a test sets a smaller one. */
  maxChars?: number;
}

/**
 * The old phone's half: collects every record of the owner, seals them with a fresh key, uploads the box to a slot and
 * gives the text for the QR, which alone carries the key. `storage` is the owner's view of the phone. Throws MoveError.
 */
export async function offerMove(storage: Storage, api: TransferApi, o: OfferInput): Promise<MoveOffer> {
  const records = await collectRecords(storage);
  const input = { owner: o.owner, now: o.now, records, ...(o.lang ? { lang: o.lang } : {}) };
  const { bytes, package: pkg } = packMove(input, o.maxChars ?? TRANSFER_MAX_CHARS);
  const key = newBoxKey();
  const ciphertext = toBase64(lockBox(key, bytes, moveContext(o.owner)));
  const slot = await api.uploadTransfer({ ciphertext }).catch(mapped);
  const unsent = (await storage.ids(Collection.outbox)).length;
  return {
    text: moveCode({ slot: slot.id, key: toBase64Url(key) }),
    expires_at: slot.expires_at,
    left_out: pkg.left_out,
    records: recordCount(pkg.records),
    unsent,
  };
}

/** The old phone's records, opened on the new one, and the device they came from (to sign out once kept). */
export interface OpenedMove {
  package: MovePackage;
  from: DeviceId;
}

/**
 * The new phone's first half: reads the scanned text, downloads the box (the slot is gone after this one read), opens
 * it with the key from the QR and checks it is this owner's. Nothing is written yet. Throws MoveError.
 */
export async function openMove(
  api: TransferApi,
  o: { owner: UserId; device: DeviceId; text: string },
): Promise<OpenedMove> {
  const qr = readMoveCode(o.text);
  if (!qr) throw new MoveError(MoveProblem.not_move);
  const download = await api.downloadTransfer(qr.slot).catch(mapped);
  if (download.device === o.device) throw new MoveError(MoveProblem.same_phone);
  let bytes: Uint8Array;
  try {
    bytes = openBox(fromBase64Url(qr.key), fromBase64(download.ciphertext), moveContext(o.owner));
  } catch (err) {
    if (err instanceof BoxError) throw new MoveError(MoveProblem.damaged);
    throw err;
  }
  return { package: readPackage(bytes, o.owner), from: download.device };
}

/**
 * Signs the old phone out for good, once the new one has written everything: it leaves the directory, so nobody seals
 * to it any more, and its session stops working. Already signed out counts as done, so a retry is safe.
 */
export async function revokeOldPhone(api: TransferApi, device: DeviceId): Promise<void> {
  try {
    await api.revokeDevice(device);
  } catch (err) {
    if (err instanceof HttpError && err.status === Status.notFound) return;
    throw err;
  }
}
