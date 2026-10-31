import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Back, kept inside the app: `handler` moves back one place and returns true, or returns false on the landing screen.
 *
 * Android's button: a registered listener replaces Capacitor's default of leaving the web view's history, so every
 * press lands here, and on the landing screen the app goes to the background (as WhatsApp and PhonePe do) instead of
 * closing.
 *
 * The web, and the installed web app: screens are not pages, so Back would leave GigSync from any of them (an
 * installed app on Android closes). While the app is off its landing screen it keeps one history entry of its own on
 * top (`keepBackInApp`); Back pops it and the handler moves back instead. On the landing screen there is no such
 * entry, and Back leaves as the browser would.
 *
 * Returns a function that removes the listener.
 */
export function onBackButton(handler: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return onBrowserBack(handler);
  const listening = App.addListener("backButton", () => {
    if (!handler()) void App.minimizeApp();
  });
  return () => void listening.then((l) => l.remove());
}

const POPSTATE = "popstate";
/** Marks the one history entry the app adds, so a reload on it is recognised. */
const GUARD_KEY = "gigsyncBack";
const GUARD = { [GUARD_KEY]: true };
const isGuard = (state: unknown) => typeof state === "object" && state !== null && GUARD_KEY in state;

let browserBack: (() => boolean) | undefined;
/** The app is off its landing screen, so Back should stay in it. */
let wanted = false;
/** The app's own entry is the current one. */
let guarded = false;
/** The app went back itself, to drop its entry; the pop that follows is not the owner's. */
let unwinding = false;

function guard(): void {
  history.pushState(GUARD, "");
  guarded = true;
}

function onPop(e: PopStateEvent): void {
  // Forward, onto the app's entry: nothing on screen moves.
  if (isGuard(e.state)) {
    guarded = true;
    return;
  }
  guarded = false;
  if (unwinding) {
    unwinding = false;
    if (wanted) guard();
    return;
  }
  // Moved back one place; the screen it lands on says, through keepBackInApp, whether Back stays in the app again.
  if (browserBack?.()) return;
  // Already on the landing screen: the press was meant to leave, so it does.
  history.back();
}

function onBrowserBack(handler: () => boolean): () => void {
  browserBack = handler;
  // A reload while the app's entry was current lands on it again.
  guarded = isGuard(history.state);
  addEventListener(POPSTATE, onPop);
  return () => {
    removeEventListener(POPSTATE, onPop);
    browserBack = undefined;
  };
}

/**
 * On the web, whether Back should stay in the app: true on any screen but the landing one. Call it whenever the screen
 * changes; it keeps exactly one entry of the app's own in the history while true, and none while false. The first one
 * follows a tap on a tab: browsers skip entries a page adds before anyone has touched it. Nothing to do natively.
 */
export function keepBackInApp(keep: boolean): void {
  if (Capacitor.isNativePlatform()) return;
  wanted = keep;
  if (unwinding) return;
  if (keep && !guarded) guard();
  else if (!keep && guarded) {
    unwinding = true;
    history.back();
  }
}
