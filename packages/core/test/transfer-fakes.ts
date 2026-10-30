import {
  type BoardProfile,
  type DeviceId,
  TRANSFER_MAX_CHARS,
  type TransferDownload,
  type TransferId,
  type TransferSlot,
  type TransferUpload,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { HttpError, MemoryStorage, OwnerStorage, type TransferApi } from "../src/index.js";

const TTL_MS = 15 * 60_000;

interface Slot {
  user: UserId;
  device: DeviceId;
  ciphertext: string;
  expires: number;
}

/**
 * workers/api's transfer routes in memory, as S built them: one slot per user, downloaded once by the same user (404
 * otherwise), 410 once expired, 413 over the limit; revoking answers 404 for a device that is not active.
 */
export class MemoryTransfers {
  readonly slots = new Map<TransferId, Slot>();
  readonly revoked = new Set<DeviceId>();
  readonly cards = new Map<UserId, BoardProfile>();
  now = Date.parse("2026-10-31T10:00:00+05:30");

  for(me: { user: UserId; device: DeviceId }): TransferApi {
    return {
      uploadTransfer: async (upload: TransferUpload): Promise<TransferSlot> => {
        if (upload.ciphertext.length > TRANSFER_MAX_CHARS) throw new HttpError(413, "too large");
        for (const [id, slot] of this.slots) if (slot.user === me.user) this.slots.delete(id);
        const id = `xfr_${ulid()}` as TransferId;
        const expires = this.now + TTL_MS;
        this.slots.set(id, { user: me.user, device: me.device, ciphertext: upload.ciphertext, expires });
        return { id, expires_at: new Date(expires).toISOString() };
      },
      downloadTransfer: async (id: TransferId): Promise<TransferDownload> => {
        const slot = this.slots.get(id);
        if (!slot || slot.user !== me.user) throw new HttpError(404, "not found");
        this.slots.delete(id);
        if (slot.expires <= this.now) throw new HttpError(410, "expired");
        return { ciphertext: slot.ciphertext, device: slot.device };
      },
      revokeDevice: async (device: DeviceId): Promise<void> => {
        if (device === me.device) throw new HttpError(409, "cannot revoke the calling device");
        if (this.revoked.has(device)) throw new HttpError(404, "not found");
        this.revoked.add(device);
      },
      myCard: async () => this.cards.get(me.user),
    };
  }
}

/** One person with an old phone and a new one, each with its own device and storage. */
export function movingOwner() {
  const user = `usr_${ulid()}` as UserId;
  const phone = () => {
    const base = new MemoryStorage();
    return { base, storage: new OwnerStorage(base, user), device: `dev_${ulid()}` as DeviceId };
  };
  return { user, old: phone(), fresh: phone() };
}
