/** Light, Dark or Auto (follows the device), kept on this device only, as in Collab. */
export const Look = { auto: "auto", light: "light", dark: "dark" } as const;
export type Look = (typeof Look)[keyof typeof Look];

const KEY = "gigsync-look";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function savedLook(): Look {
  try {
    const value = localStorage.getItem(KEY);
    return value === Look.light || value === Look.dark ? value : Look.auto;
  } catch {
    return Look.auto;
  }
}

/** Puts data-look on <html>; Auto resolves to the device's current scheme. */
export function applyLook(look: Look = savedLook()): void {
  const resolved = look === Look.auto ? (matchMedia(DARK_QUERY).matches ? Look.dark : Look.light) : look;
  document.documentElement.dataset.look = resolved;
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
