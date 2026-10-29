import { type DevicePublicKeys, type DeviceSecrets, open, publicKeysOf, type Sealed, sign } from "@gigsync/crypto";
import type { DeviceId } from "@gigsync/protocol";
import type { Keys } from "./ports.js";

/**
 * Keys held in memory, from secrets the shell loaded (the app from its keystore, tests from newDeviceSecrets()).
 * The secrets never leave this object except through what the shell itself persisted.
 */
export class SecretKeys implements Keys {
  private readonly publics: DevicePublicKeys;

  constructor(private readonly secrets: DeviceSecrets) {
    this.publics = publicKeysOf(secrets);
  }

  async publicKeys(): Promise<DevicePublicKeys> {
    return this.publics;
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    return sign(bytes, this.secrets.signing);
  }

  async open(sealed: Sealed, device: DeviceId): Promise<Uint8Array> {
    return open(sealed, device, this.secrets.encryption);
  }
}
