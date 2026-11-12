import { styleSystemBars } from "../adapters/system-bars.js";

/** Light, Dark or Auto (follows the device), kept on this device only, as in Collab. */
export const Look = { auto: "auto", light: "light", dark: "dark" } as const;
export type Look = (typeof Look)[keyof typeof Look];
type Resolved = typeof Look.light | typeof Look.dark;

const KEY = "gigsync-look";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLOR = 'meta[name="theme-color"]';

/**
 * The page's background in each look (styles.css --bg). The phone's status bar takes it, so the bar and the top bar
 * read as one band. index.html's pre-paint script holds the same two values, for the moment before this runs.
 */
const BAR_COLOUR: Readonly<Record<Resolved, string>> = { light: "#f5eddd", dark: "#1c120d" };

export function savedLook(): Look {
  try {
    const value = localStorage.getItem(KEY);
    return value === Look.light || value === Look.dark ? value : Look.auto;
  } catch {
    return Look.auto;
  }
}

/** One theme-color, set to the look actually shown: a media-query pair would follow the device, not a chosen look. */
function paintStatusBar(resolved: Resolved): void {
  let meta = document.querySelector<HTMLMetaElement>(THEME_COLOR);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = BAR_COLOUR[resolved];
  styleSystemBars(resolved === Look.dark);
}

/** Puts data-look on <html> and the status bar in step with it; Auto resolves to the device's current scheme. */
export function applyLook(look: Look = savedLook()): void {
  const resolved = look === Look.auto ? (matchMedia(DARK_QUERY).matches ? Look.dark : Look.light) : look;
  document.documentElement.dataset.look = resolved;
  paintStatusBar(resolved);
}

export function saveLook(look: Look): void {
  try {
    localStorage.setItem(KEY, look);
  } catch {
    // Private windows can refuse storage; the look still applies for this visit.
  }
  applyLook(look);
}

/** Follow the device while the look is Auto. */
export function watchDeviceLook(): void {
  try {
    matchMedia(DARK_QUERY).addEventListener("change", () => applyLook());
  } catch {
    // Old webviews without matchMedia listeners keep the look they opened with.
  }
}
