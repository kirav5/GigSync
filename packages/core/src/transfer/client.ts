import {
  BoardProfile,
  type DeviceId,
  TransferDownload,
  type TransferId,
  TransferSlot,
  type TransferUpload,
} from "@gigsync/protocol";
import { HttpMethod } from "../http.js";
import { ApiClient, ApiPath, HttpError } from "../net/api.js";
import type { TransferApi } from "./types.js";

/** The routes of workers/api for a new phone (ADR 0037): `POST`/`GET /v1/transfer`, `DELETE /v1/devices/:device`. */
export const NewPhonePath = {
  transfer: "/v1/transfer",
  devices: "/v1/devices/",
} as const;

const SLASH = "/";
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

/** ApiClient with the calls a phone makes when its owner moves to a new one, or comes back to an empty one. */
export class NewPhoneClient extends ApiClient implements TransferApi {
  async uploadTransfer(upload: TransferUpload): Promise<TransferSlot> {
    return TransferSlot.parse(await this.call(HttpMethod.post, NewPhonePath.transfer, upload));
  }

  async downloadTransfer(id: TransferId): Promise<TransferDownload> {
    return TransferDownload.parse(await this.call(HttpMethod.get, `${NewPhonePath.transfer}${SLASH}${id}`));
  }

  async revokeDevice(device: DeviceId): Promise<void> {
    await this.call(HttpMethod.delete, `${NewPhonePath.devices}${device}`);
  }

  async myCard(): Promise<BoardProfile | undefined> {
    try {
      return BoardProfile.parse(await this.call(HttpMethod.get, ApiPath.boardProfile));
    } catch (err) {
      if (err instanceof HttpError && err.status === NOT_FOUND) return undefined;
      throw err;
    }
  }

  /**
   * Whether this device is still signed in: false once the owner's new phone signed it out after a move. Any answer
   * but 401 means it still is (a household has no card: 404).
   */
  async stillSignedIn(): Promise<boolean> {
    try {
      await this.call(HttpMethod.get, ApiPath.boardProfile);
      return true;
    } catch (err) {
      if (err instanceof HttpError && err.status === UNAUTHORIZED) return false;
      if (err instanceof HttpError) return true;
      throw err;
    }
  }
}
