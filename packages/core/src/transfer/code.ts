import { TransferQr } from "@gigsync/protocol";

/**
 * The text of the old phone's move QR: a prefix no other QR carries, then the slot and the key. Not a link, so a
 * phone's own camera that reads it shows text instead of opening a page, and the key never reaches a server.
 */
const MOVE_CODE_PREFIX = "gigsync-move:";
/** Between the slot and the key; neither a slot id nor base64url holds it. */
const SLOT_KEY_SEP = ".";

export function moveCode(qr: TransferQr): string {
  return `${MOVE_CODE_PREFIX}${qr.slot}${SLOT_KEY_SEP}${qr.key}`;
}

/** The slot and key a scanned text carries, or undefined when it is not a move code. */
export function readMoveCode(text: string): TransferQr | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith(MOVE_CODE_PREFIX)) return undefined;
  const [slot, key, ...rest] = trimmed.slice(MOVE_CODE_PREFIX.length).split(SLOT_KEY_SEP);
  if (rest.length > 0) return undefined;
  const parsed = TransferQr.safeParse({ slot, key });
  return parsed.success ? parsed.data : undefined;
}
