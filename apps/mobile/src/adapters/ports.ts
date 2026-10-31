import { Preferences } from "@capacitor/preferences";
import type { Embedder, Keys, Model, Ports, Storage } from "@gigsync/core";
import { SecretKeys, SystemClock, traced } from "@gigsync/core";
import { type DeviceSecrets, newDeviceSecrets, type Sealed } from "@gigsync/crypto";
import type { DeviceId } from "@gigsync/protocol";
import { understanding } from "./embedder.js";
import { chosenModel } from "./model.js";

/**
 * The app's implementations of the core's ports. These are the ONLY place platform APIs are touched, so moving
 * to another shell later means rewriting this file, not the agent.
 *
 * M0 state: Preferences-backed storage and software keys. M0 hardening replaces them with the SQLCipher plugin
 * and a Keystore/Keychain-wrapped key; the interfaces do not change.
 */

class PreferencesStorage implements Storage {
  private key = (c: string, id: string) => `${c}:${id}`;
  async get<T>(c: string, id: string) {
    const { value } = await Preferences.get({ key: this.key(c, id) });
    return value ? (JSON.parse(value) as T) : undefined;
  }
  async put<T>(c: string, id: string, v: T) {
    await Preferences.set({ key: this.key(c, id), value: JSON.stringify(v) });
  }
  async delete(c: string, id: string) {
    await Preferences.remove({ key: this.key(c, id) });
  }
  async list<T>(c: string) {
    const { keys } = await Preferences.keys();
    const mine = keys.filter((k) => k.startsWith(`${c}:`)).sort();
    const out: T[] = [];
    for (const k of mine) {
      const { value } = await Preferences.get({ key: k });
      if (value) out.push(JSON.parse(value) as T);
    }
    return out;
  }
  async ids(c: string) {
    const { keys } = await Preferences.keys();
    const prefix = `${c}:`;
    return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  }
}

/** Preferences key holding the device's software secrets (v2: Ed25519 + X25519; v1 held Ed25519 only). */
const DEVICE_SECRETS = "keys:device:v2";

/**
 * The device's secrets, loaded or made once per app. Two loaders racing on a first launch (React's StrictMode runs
 * `useMemo` twice in development) would each make and store different secrets: the phone would register one pair and
 * keep the other, and after a restart could open nothing sent to it.
 */
let deviceSecrets: Promise<SecretKeys> | undefined;
function loadDeviceSecrets(): Promise<SecretKeys> {
  deviceSecrets ??= (async () => {
    const { value } = await Preferences.get({ key: DEVICE_SECRETS });
    if (value) return new SecretKeys(JSON.parse(value) as DeviceSecrets);
    const fresh = newDeviceSecrets();
    await Preferences.set({ key: DEVICE_SECRETS, value: JSON.stringify(fresh) });
    return new SecretKeys(fresh);
  })();
  return deviceSecrets;
}

/** Software keys. DEV ONLY: the secrets live in Preferences until the Keystore plugin lands. */
class SoftwareKeys implements Keys {
  private keys = loadDeviceSecrets();
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
  return { embed: traced("embedder.embed", understanding.embed.bind(understanding)) };
}

export function createPorts(): Ports {
  return {
    storage: new PreferencesStorage(),
    keys: new SoftwareKeys(),
    model: createModel(),
    clock: new SystemClock(),
    embedder: createEmbedder(),
  };
}
