import { Capacitor } from "@capacitor/core";
import { log } from "@gigsync/core";
import { useSyncExternalStore } from "react";

/** How this copy of the app could get onto the home screen, as the install card offers it. */
export const InstallState = {
  /** The Android or iPhone app: already installed, never offered. */
  native: "native",
  /** Opened from the home screen, or installed while open. */
  installed: "installed",
  /** Chrome offered its install prompt, kept for a tap. */
  prompt: "prompt",
  /** iPhone or iPad: Share, then Add to Home Screen, by hand. */
  ios: "ios",
  /** Any other browser: its own menu. */
  manual: "manual",
} as const;
export type InstallState = (typeof InstallState)[keyof typeof InstallState];

/** Chrome's install prompt, which TypeScript's DOM types leave out. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: string }>;
}

const PROMPT_EVENT = "beforeinstallprompt";
const INSTALLED_EVENT = "appinstalled";
const ACCEPTED = "accepted";
const STANDALONE = "(display-mode: standalone)";
/** Built into the web app's root by the plugin in vite.config.ts. */
const SERVICE_WORKER = "./sw.js";
const LOADED: DocumentReadyState = "complete";
/** One flag per place, so "Not now" on the language screen still lets Profile offer it. */
const dismissedKey = (place: string) => `gigsync-install-dismissed-${place}`;
const IOS = /iPhone|iPod|iPad/;
const MAC = /Macintosh/;

let offered: BeforeInstallPromptEvent | undefined;
let installedHere = false;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};

const isPromptEvent = (e: Event): e is BeforeInstallPromptEvent =>
  "prompt" in e && typeof e.prompt === "function" && "userChoice" in e;

/** Opened from the home screen: Chrome and Android report a display mode, iOS Safari its own flag. */
const standalone = () => matchMedia(STANDALONE).matches || Reflect.get(navigator, "standalone") === true;

/** iPadOS asks for desktop pages and says "Macintosh"; only its touch screen gives it away. */
const isIos = () => IOS.test(navigator.userAgent) || (MAC.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function current(): InstallState {
  if (Capacitor.isNativePlatform()) return InstallState.native;
  if (installedHere || standalone()) return InstallState.installed;
  if (offered) return InstallState.prompt;
  return isIos() ? InstallState.ios : InstallState.manual;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps Chrome's install prompt for the install card instead of letting the browser show its own banner, and notices
 * an install made from the browser's menu. Call once, before the first render: Chrome may fire the prompt early.
 */
export function watchInstall(): void {
  if (Capacitor.isNativePlatform()) return;
  globalThis.addEventListener(PROMPT_EVENT, (e) => {
    if (!isPromptEvent(e)) return;
    e.preventDefault();
    offered = e;
    changed();
  });
  globalThis.addEventListener(INSTALLED_EVENT, () => {
    offered = undefined;
    installedHere = true;
    changed();
  });
}

/** The install card's state, kept current as Chrome offers or the owner installs. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, current);
}

/** Shows Chrome's install prompt from the owner's tap. True when they accepted. */
export async function install(): Promise<boolean> {
  const e = offered;
  if (!e) return false;
  // A prompt can be shown once; Chrome fires a new event when it may ask again.
  offered = undefined;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === ACCEPTED) installedHere = true;
  changed();
  return installedHere;
}

/** Whether the owner said "Not now" to the card in this place. Storage can be blocked: then it shows again. */
export function dismissed(place: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(place)) !== null;
  } catch {
    return false;
  }
}

export function dismiss(place: string): void {
  try {
    localStorage.setItem(dismissedKey(place), new Date().toISOString());
  } catch {
    // Private mode or blocked storage: the card simply shows again next time.
  }
}

/**
 * Registers the service worker that keeps the app shell for offline starts. Release web builds only: the native apps
 * load from their bundle, and a worker caching the dev server would serve stale modules. Asks for persistent storage
 * only once installed, where browsers grant it quietly; Firefox would put a prompt in front of a first visit.
 */
export function registerServiceWorker(): void {
  if (Capacitor.isNativePlatform() || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () =>
    navigator.serviceWorker.register(SERVICE_WORKER).catch((error: unknown) => {
      log.warn("install: service worker not registered", { error });
    });
  if (document.readyState === LOADED) void register();
  else globalThis.addEventListener("load", () => void register(), { once: true });
  if (standalone()) void navigator.storage?.persist();
}
