import { Preferences } from "@capacitor/preferences";
import type { Keys, Model, Ports, Storage } from "@gigsync/core";
import { DEFAULT_MAX_TOKENS, SecretKeys, SystemClock, traced } from "@gigsync/core";
import { type DeviceSecrets, newDeviceSecrets, type Sealed } from "@gigsync/crypto";
import { GigSyncLLM } from "@gigsync/plugin-llm";
import type { DeviceId } from "@gigsync/protocol";
import { OllamaModel } from "./ollama.js";

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
}

/** Preferences key holding the device's software secrets (v2: Ed25519 + X25519; v1 held Ed25519 only). */
const DEVICE_SECRETS = "keys:device:v2";

/** Software keys. DEV ONLY: the secrets live in Preferences until the Keystore plugin lands. */
class SoftwareKeys implements Keys {
  private keys: Promise<SecretKeys>;
  constructor() {
    this.keys = (async () => {
      const { value } = await Preferences.get({ key: DEVICE_SECRETS });
      if (value) return new SecretKeys(JSON.parse(value) as DeviceSecrets);
      const fresh = newDeviceSecrets();
      await Preferences.set({ key: DEVICE_SECRETS, value: JSON.stringify(fresh) });
      return new SecretKeys(fresh);
    })();
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

/** The native LLM plugin; on web it answers nothing, so the agent runs in lite mode. */
class PluginModel implements Model {
  async generate(prompt: string, options?: { maxTokens?: number }) {
    try {
      const { text, available } = await GigSyncLLM.generate({
        prompt,
        maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      });
      return available ? text : null;
    } catch {
      return null;
    }
  }
}

/** Dev builds can use a model from Ollama on this computer; everything else uses the native plugin. */
const ollamaModel = import.meta.env.DEV ? import.meta.env.VITE_OLLAMA_MODEL : undefined;

/** What the header shows as the model in use. */
export const modelLabel = ollamaModel ? `ollama ${ollamaModel}` : "lite mode (no model)";

function createModel(): Model {
  const model = ollamaModel ? new OllamaModel(ollamaModel) : new PluginModel();
  // Prompts and replies are private: shown in local debug logs only.
  return { generate: traced("model.generate", model.generate.bind(model)) };
}

export function createPorts(): Ports {
  return {
    storage: new PreferencesStorage(),
    keys: new SoftwareKeys(),
    model: createModel(),
    clock: new SystemClock(),
  };
}
