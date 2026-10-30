import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

/**
 * How much shorter than its tallest the visible area must get before the keyboard counts as open, in CSS px. A
 * browser's toolbar sliding in or out changes it by less.
 */
const KEYBOARD_MIN_PX = 150;
/** `data-keyboard` on <html> while the keyboard is up: the dock (styles.css) sits on the keys, without the home indicator's room. */
const KEYBOARD_OPEN = "open";
/** The app's height and offset, following the part of the page the keyboard leaves visible (styles.css `.app`). */
const APP_HEIGHT = "--app-h";
const APP_TOP = "--app-top";
const IOS = /iPhone|iPad|iPod/;
const MAC = /Macintosh/;
/** A pinch-zoomed page has a smaller visible area with no keyboard at all; leave the layout alone until it unzooms. */
const ZOOM_TOLERANCE = 0.01;

function markKeyboard(open: boolean): void {
  if (open) document.documentElement.dataset.keyboard = KEYBOARD_OPEN;
  else delete document.documentElement.dataset.keyboard;
}

/**
 * The app scrolls inside its content panel, not the page, and Android's WebView (and Chrome) only bring a focused
 * field into view for the page. So when the visible area changes size with a field focused, scroll it into view.
 */
function revealFocusedField(): void {
  const field = document.activeElement;
  const typing =
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement;
  if (typing) field.scrollIntoView({ block: "nearest" });
}

/** iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad. */
const isIos = () => IOS.test(navigator.userAgent) || (MAC.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * The native apps: the keyboard shrinks the web view (the Keyboard plugin's resize "native", in capacitor.config.ts),
 * so only the dock needs telling, from the plugin's own events. The reveal runs on the resize itself, not on
 * keyboardDidShow, which on iOS fires before the web view has shrunk.
 */
function watchNative(): void {
  void Keyboard.addListener("keyboardWillShow", () => markKeyboard(true));
  void Keyboard.addListener("keyboardWillHide", () => markKeyboard(false));
  globalThis.addEventListener("resize", revealFocusedField);
}

/**
 * The web app: the app takes the height of the visible area, so the dock sits just above the keys. The keyboard is
 * taken as open when that area is well below the tallest seen at this width (the width changes only on rotation; the
 * keyboard never changes it). Comparing with `innerHeight` would never fire: `interactive-widget=resizes-content`
 * shrinks the window along with the keyboard. iOS Safari does not resize anything: it pans the page up under the top
 * of the screen instead. There the pan is undone and the app moved down to where the visible area starts.
 */
function watchWeb(): void {
  const view = globalThis.visualViewport;
  if (!view) return;
  const ios = isIos();
  const touch = navigator.maxTouchPoints > 0;
  const tallest = new Map<number, number>();
  const root = document.documentElement.style;

  const follow = () => {
    if (Math.abs(view.scale - 1) > ZOOM_TOLERANCE) return;
    const max = Math.max(tallest.get(innerWidth) ?? 0, view.height);
    tallest.set(innerWidth, max);
    root.setProperty(APP_HEIGHT, `${view.height}px`);
    // A desktop window made shorter is not a keyboard.
    markKeyboard(touch && view.height < max - KEYBOARD_MIN_PX);
    if (ios) root.setProperty(APP_TOP, `${view.offsetTop}px`);
  };

  view.addEventListener("resize", () => {
    follow();
    requestAnimationFrame(() => {
      revealFocusedField();
      if (!ios) return;
      scrollTo(0, 0);
      follow();
    });
  });
  view.addEventListener("scroll", follow);
  follow();
}

/**
 * Keeps the dock and the field being typed into above the on-screen keyboard.
 * Called once, before the first render.
 */
export function keepFocusedFieldVisible(): void {
  if (Capacitor.isNativePlatform()) watchNative();
  else watchWeb();
}
