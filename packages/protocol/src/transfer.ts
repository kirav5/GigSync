import { z } from "zod";
import { DeviceId, TransferId } from "./ids.js";

/**
 * Moving to a new phone (ADR 0037 §3). The old phone encrypts its owner's data with a fresh key, uploads the ciphertext
 * to a transfer slot and shows a QR carrying the slot and the key. The new phone, signed in as the same number, scans
 * it, downloads the ciphertext once, decrypts it and then revokes the old device. The key never reaches the server, which
 * holds the ciphertext only until the first download or TRANSFER_TTL_MS, whichever comes first.
 */

/** How long a slot waits for the new phone. */
export const TRANSFER_TTL_MS = 15 * 60_000;
/**
 * The longest ciphertext a slot takes, in base64 characters (about 3 MiB of bytes). Bounds the request body, the row
 * and the Worker's CPU parsing it; a phone with more to move compresses before encrypting.
 */
export const TRANSFER_MAX_CHARS = 4 * 1024 * 1024;
/** Slots one person may create in an hour: a few retries, not storage. */
export const TRANSFERS_PER_HOUR = 5;
/** The fresh symmetric key the QR carries, in bytes (AES-256-GCM or XChaCha20-Poly1305 both take 32). */
export const TRANSFER_KEY_BYTES = 32;

/** Opaque to the server: base64 of whatever the old phone sealed with the transfer key. */
const Ciphertext = z.base64().min(1).max(TRANSFER_MAX_CHARS);

/** `POST /v1/transfer`: the old phone's sealed data. Creating a slot replaces any slot the caller already had. */
export const TransferUpload = z.object({ ciphertext: Ciphertext });
export type TransferUpload = z.infer<typeof TransferUpload>;

/** The answer to `POST /v1/transfer` (201): the slot to put in the QR and when it stops working. */
export const TransferSlot = z.object({ id: TransferId, expires_at: z.iso.datetime({ offset: true }) });
export type TransferSlot = z.infer<typeof TransferSlot>;

/**
 * `GET /v1/transfer/:id` (200), by the same user only, before expiry: the ciphertext and the device that uploaded it,
 * which the new phone revokes (`DELETE /v1/devices/:device`) once it has decrypted everything. The slot is deleted by
 * this read, so a second download finds nothing (404); an expired slot answers 410 and is deleted too.
 */
export const TransferDownload = z.object({ ciphertext: Ciphertext, device: DeviceId });
export type TransferDownload = z.infer<typeof TransferDownload>;

/** The transfer key as the QR carries it: base64url without padding. */
export const TransferKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "base64url")
  .length(Math.ceil((TRANSFER_KEY_BYTES * 4) / 3));
export type TransferKey = z.infer<typeof TransferKey>;

/** What the old phone's QR encodes (phone to phone, never sent to the server): the slot and the key. */
export const TransferQr = z.object({ slot: TransferId, key: TransferKey });
export type TransferQr = z.infer<typeof TransferQr>;
