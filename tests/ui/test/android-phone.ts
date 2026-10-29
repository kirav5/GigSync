import { execFileSync } from "node:child_process";
import { _android, type AndroidDevice, type Page } from "@playwright/test";
import { API, APP, SHOTS, screenSizeShots } from "./helpers.js";

/** The Capacitor app's package on the emulator. */
export const PACKAGE = "app.gigsync";

/**
 * The attached emulator and its app's WebView, freshly cleared. The emulator reaches the dev server and API on this
 * computer through adb, and a reconnect drops those forwards, so they are set every time. Build the app with
 * `CAP_SERVER_URL=http://localhost:5173 pnpm exec cap sync android` first, or it loads its bundled copy (origin
 * https://localhost), which may not call the plain-http local API.
 */
export async function androidPhone(): Promise<{ phone: AndroidDevice; page: Page }> {
  const [phone] = await _android.devices();
  if (!phone) throw new Error("no Android device: start the emulator first");
  for (const url of [APP, API]) {
    const port = new URL(url).port;
    execFileSync("adb", ["-s", phone.serial(), "reverse", `tcp:${port}`, `tcp:${port}`]);
  }
  // A fresh install each run: no saved language or account, and no ML Kit packs from an earlier run.
  await phone.shell(`pm clear ${PACKAGE}`);
  await phone.shell(`am start -W -n ${PACKAGE}/.MainActivity`);
  const page = await (await phone.webView({ pkg: PACKAGE })).page();
  screenSizeShots.add(page);
  // A lost `adb reverse` leaves the app on screen but every request failing: say so now, not after the timeout.
  const reached = await page.evaluate(
    (url) =>
      fetch(url).then(
        (r) => r.ok,
        () => false,
      ),
    `${API}/health`,
  );
  if (!reached) throw new Error(`the phone cannot reach ${API}: check adb reverse and CAP_SERVER_URL`);
  return { phone, page };
}

/** The emulator's own screen, as the person holding the phone sees it. */
export const deviceShot = (phone: AndroidDevice, name: string) =>
  phone.screenshot({ path: `${SHOTS}android-${name}.png` });
