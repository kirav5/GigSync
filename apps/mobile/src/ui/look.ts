import { styleSystemBars } from "../adapters/system-bars.js";

/**
 * GigSync has one look, the light cream one, on every phone whatever its own night mode: the owner asked for light
 * only. The status bar takes the page's background (styles.css --bg), so the bar and the top bar read as one band.
 */
const BAR_COLOUR = "#faf6ee";
const THEME_COLOR = 'meta[name="theme-color"]';
const LIGHT = "light";

/** Puts the light look on <html> and the status bar in step with it. */
export function applyLook(): void {
  document.documentElement.dataset.look = LIGHT;
  let meta = document.querySelector<HTMLMetaElement>(THEME_COLOR);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = BAR_COLOUR;
  styleSystemBars(false);
}
