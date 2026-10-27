import { Preferences } from "@capacitor/preferences";
import type { Keys, Model, Ports, Storage } from "@gigsync/core";
import { SystemClock, traced } from "@gigsync/core";
import * as ed from "@noble/ed25519";
import { chosenModel } from "./model.js";

/**
 * The app's implementations of the core's ports. These are the ONLY place platform APIs are touched, so moving
 * to another shell later means rewriting this file, not the agent.
 *
 * M0 state: Preferences-backed storage and a software key. M0 hardening replaces them with the SQLCipher plugin
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
}

/** Preferences key holding the software device key. */
const DEVICE_KEY = "keys:device";

/** Software Ed25519 key. DEV ONLY: lives in Preferences until the Keystore plugin lands. */
class SoftwareKeys implements Keys {
  private priv: Promise<Uint8Array>;
  constructor() {
    this.priv = (async () => {
      const { value } = await Preferences.get({ key: DEVICE_KEY });
      if (value) return fromBase64(value);
      const fresh = ed.utils.randomSecretKey();
      await Preferences.set({ key: DEVICE_KEY, value: toBase64(fresh) });
      return fresh;
    })();
  }
  async publicKey() {
    return toBase64(await ed.getPublicKeyAsync(await this.priv));
  }
  async sign(bytes: Uint8Array) {
    return ed.signAsync(bytes, await this.priv);
  }
  async verify(bytes: Uint8Array, sig: Uint8Array, publicKey: string) {
    return ed.verifyAsync(sig, bytes, fromBase64(publicKey));
  }
}

function createModel(): Model {
  // The engine is chosen in Settings (adapters/model.ts). Prompts and replies are private: shown in local debug logs only.
  return { generate: traced("model.generate", chosenModel.generate.bind(chosenModel)) };
}

export function createPorts(): Ports {
  return {
    storage: new PreferencesStorage(),
    keys: new SoftwareKeys(),
    model: createModel(),
    clock: new SystemClock(),
  };
}

const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
