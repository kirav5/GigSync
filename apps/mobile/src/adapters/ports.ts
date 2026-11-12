import type { Embedder, Keys, Model, Ports, Storage } from "@gigsync/core";
import { SecretKeys, SystemClock, traced } from "@gigsync/core";
import { type DeviceSecrets, newDeviceSecrets, type Sealed } from "@gigsync/crypto";
import type { DeviceId } from "@gigsync/protocol";
import { understanding } from "./embedder.js";
import { chosenModel } from "./model.js";
import { KEYS_COLLECTION } from "./store/move.js";
import { phoneStorage } from "./store/open.js";

/**
 * The app's implementations of the core's ports. These are the ONLY place platform APIs are touched, so moving
 * to another shell later means rewriting this file, not the agent.
 *
 * Storage (adapters/store, ADR 0065): on the web, IndexedDB with every record sealed under a key script cannot read;
 * on a native build, still plain Preferences until the SQLCipher plugin with a Keystore/Keychain-held key. The keys
 * are software keys on both; the interfaces do not change.
 */

/** The device's software secrets, in the `keys` collection (v2: Ed25519 + X25519; v1 held Ed25519 only). */
const DEVICE_SECRETS_ID = "device:v2";

/**
 * The device's secrets, loaded or made once per app. Two loaders racing on a first launch (React's StrictMode runs
 * `useMemo` twice in development) would each make and store different secrets: the phone would register one pair and
 * keep the other, and after a restart could open nothing sent to it.
 */
let deviceSecrets: Promise<SecretKeys> | undefined;
function loadDeviceSecrets(storage: Storage): Promise<SecretKeys> {
  deviceSecrets ??= (async () => {
    const kept = await storage.get<DeviceSecrets>(KEYS_COLLECTION, DEVICE_SECRETS_ID);
    if (kept) return new SecretKeys(kept);
    const fresh = newDeviceSecrets();
    await storage.put(KEYS_COLLECTION, DEVICE_SECRETS_ID, fresh);
    return new SecretKeys(fresh);
  })();
  return deviceSecrets;
}

/**
 * Software keys. On the web the two private keys are sealed at rest like every other record (ADR 0065), but they are
 * raw bytes in memory whenever the app runs: @gigsync/crypto signs and opens with noble, which needs them so. Native
 * builds keep them in plain Preferences until the Keystore/Keychain store lands (ADR 0065 §5).
 */
class SoftwareKeys implements Keys {
  private readonly keys: Promise<SecretKeys>;
  constructor(storage: Storage) {
    this.keys = loadDeviceSecrets(storage);
  }
  async publicKeys() {
    return (await this.keys).publicKeys();
  }
  async sign(bytes: Uint8Array) {
    return (await this.keys).sign(bytes);
  }
  async open(sealed: Sealed, device: DeviceId) {
    return (await this.keys).open(sealed, device);
  }
}

function createModel(): Model {
  // The engine is chosen in Settings (adapters/model.ts). Prompts and replies are private: shown in local debug logs only.
  return { generate: traced("model.generate", chosenModel.generate.bind(chosenModel)) };
}

function createEmbedder(): Embedder {
  // The understanding pack (adapters/embedder.ts): null until the owner has fetched it, and in lite mode.
  return {
    embed: traced("embedder.embed", understanding.embed.bind(understanding)),
    embedMany: understanding.embedMany.bind(understanding),
  };
}

export function createPorts(): Ports {
  const storage = phoneStorage();
  return {
    storage,
    keys: new SoftwareKeys(storage),
    model: createModel(),
    clock: new SystemClock(),
    embedder: createEmbedder(),
  };
}
