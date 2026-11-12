import { Preferences } from "@capacitor/preferences";
import type { Storage } from "@gigsync/core";
import type { LegacyStore } from "./move.js";

/**
 * The store the app began with: Capacitor Preferences, one flat list of `<collection>:<id>` keys holding plain JSON
 * (on the web, localStorage). Still what a native build uses, and what the web falls back to where the encrypted
 * store cannot work (ADR 0065); `list` and `ids` read every key of every collection.
 */
export class PreferencesStorage implements Storage {
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

/**
 * Set once this phone's records live in the encrypted store. If that store then cannot be opened, the app must not
 * quietly start again on this one: it would look like a new phone, make new device keys and sign in over the old ones.
 */
const MOVED_FLAG = "storage-moved";

export async function movedOut(): Promise<boolean> {
  return (await Preferences.get({ key: MOVED_FLAG })).value !== null;
}

/** Preferences as the old store to move out of (move.ts). */
export const legacyStore: LegacyStore = {
  keys: async () => (await Preferences.keys()).keys,
  get: async (key) => (await Preferences.get({ key })).value,
  remove: (key) => Preferences.remove({ key }),
  flagMoved: () => Preferences.set({ key: MOVED_FLAG, value: new Date().toISOString() }),
};
