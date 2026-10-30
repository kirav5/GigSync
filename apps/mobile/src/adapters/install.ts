import { Capacitor } from "@capacitor/core";
import { log } from "@gigsync/core";
import { useSyncExternalStore } from "react";

/** How this copy of the app could get onto the home screen, as Install app and the install card offer it. */
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

/** The device and browser the Install screen says the steps for, where no prompt can do it. */
export const InstallDevice = {
  /** Safari on an iPhone or iPad. */
  iphoneSafari: "iphone_safari",
  /** Chrome, Firefox or Edge on an iPhone: Share is theirs too, or the page opens in Safari. */
  iphoneOther: "iphone_other",
  /** An Android phone: Chrome's menu ⋮. */
  android: "android",
  /** Safari on a Mac: File › Add to Dock, with no icon in the address bar. */
  macSafari: "mac_safari",
  /** Chrome or Edge on a computer: the install icon in the address bar, or the menu. */
  computer: "computer",
} as const;
export type InstallDevice = (typeof InstallDevice)[keyof typeof InstallDevice];

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
/** "Not now" on the language screen's card; the name keeps the place it had when Settings had a card too. */
const DISMISSED_KEY = "gigsync-install-dismissed-onboarding";
const IOS = /iPhone|iPod|iPad/;
const MAC = /Macintosh/;
const ANDROID = /Android/;
/** The other browsers on an iPhone name themselves; Safari does not. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS/;
/** Every Chromium and Firefox build says "Safari" too, so Safari is the one that names no other engine. */
const NOT_SAFARI = /Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/;
/** The states with something to offer: the app on the home screen, or the native one, needs no Install app. */
const OFFERED: ReadonlySet<InstallState> = new Set([InstallState.prompt, InstallState.ios, InstallState.manual]);

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

/** Which steps to show for this device and browser. */
export function installDevice(): InstallDevice {
  const ua = navigator.userAgent;
  if (isIos()) return IOS_OTHER_BROWSER.test(ua) ? InstallDevice.iphoneOther : InstallDevice.iphoneSafari;
  if (ANDROID.test(ua)) return InstallDevice.android;
  return MAC.test(ua) && !NOT_SAFARI.test(ua) ? InstallDevice.macSafari : InstallDevice.computer;
}

/** Whether there is anything to install: not in the native app, nor once on the home screen. */
export const installOffered = (state: InstallState): boolean => OFFERED.has(state);

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
 * Keeps Chrome's install prompt for Install app instead of letting the browser show its own banner, and notices
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

/** The install state, kept current as Chrome offers or the owner installs. */
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

/** Whether the owner said "Not now" to the language screen's card. Storage can be blocked: then it shows again. */
export function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

export function dismiss(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
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
