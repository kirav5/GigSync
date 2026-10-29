import { Preferences } from "@capacitor/preferences";
import type { SpeechVendor } from "@gigsync/plugin-speech";
import { useSyncExternalStore } from "react";

/**
 * The owner's voice settings, kept with Preferences (spec §3.3, ADR 0023): whether questions are read aloud, and which
 * companies may turn their voice into text when the phone cannot do it itself. speech.ts reads both before it speaks
 * or listens; Profile's Voice section and the Composer's consent sheet change them.
 */

const VENDORS: readonly SpeechVendor[] = ["google", "apple", "browser"];

/** A setting kept in Preferences under one key: readable at once, watchable from React. */
function setting<T>(key: string, fallback: T, parse: (raw: unknown) => T | undefined) {
  let value = fallback;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const fn of listeners) fn();
  };
  const loaded = Preferences.get({ key })
    .then(({ value: raw }) => {
      if (raw === null) return;
      value = parse(JSON.parse(raw)) ?? fallback;
      changed();
    })
    .catch(() => {
      // Unreadable: the default stands.
    });
  return {
    loaded,
    get: () => value,
    set(next: T) {
      value = next;
      changed();
      void Preferences.set({ key, value: JSON.stringify(next) }).catch(() => {
        // Not saved: it still holds until the app closes.
      });
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** Whether questions are read aloud; on by default. */
const readAloudOn = setting("speech:read-aloud", true, (raw) => (typeof raw === "boolean" ? raw : undefined));
/** The companies the owner allowed to turn their voice into text (amendment A1); empty until they allow one. */
const cloudConsent = setting<readonly SpeechVendor[]>("speech:cloud-consent", [], (raw) =>
  Array.isArray(raw) ? VENDORS.filter((v) => raw.includes(v)) : undefined,
);

const hasConsent = (vendor: SpeechVendor) => cloudConsent.get().includes(vendor);

/** Whether questions should be read aloud; waits for the stored answer. */
export async function readAloudWanted(): Promise<boolean> {
  await readAloudOn.loaded;
  return readAloudOn.get();
}

export function useReadAloudPref(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(readAloudOn.subscribe, readAloudOn.get), readAloudOn.set];
}

/** Whether the owner has allowed `vendor` to hear them; waits for the stored answer. */
export async function cloudAllowed(vendor: SpeechVendor): Promise<boolean> {
  await cloudConsent.loaded;
  return hasConsent(vendor);
}

export function allowCloud(vendor: SpeechVendor): void {
  if (!hasConsent(vendor)) cloudConsent.set([...cloudConsent.get(), vendor]);
}

export function withdrawCloud(vendor: SpeechVendor): void {
  cloudConsent.set(cloudConsent.get().filter((v) => v !== vendor));
}

/**
 * At sign-out: the consent was the owner's own, so the next person on this phone is asked before any company hears
 * them.
 */
export function forgetCloudConsent(): void {
  cloudConsent.set([]);
}

/** The companies currently allowed, for Profile's Voice section. */
export function useCloudConsent(): readonly SpeechVendor[] {
  return useSyncExternalStore(cloudConsent.subscribe, cloudConsent.get);
}
