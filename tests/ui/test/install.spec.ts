import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { devices, expect, type Page, test } from "@playwright/test";
import { APP, newPhone, open, Role, RUN, shell, signIn } from "./helpers.js";

/**
 * The web app's install card (ui/InstallCard.tsx). On iPhone it shows on the language screen, before sign-in, because
 * the home-screen app keeps its own storage apart from Safari's. In Chrome, Profile offers Chrome's own prompt. "Not
 * now" is remembered on that phone.
 */

const { en, hi } = Lang.enum;
const card = (page: Page, lang: Lang) => page.getByRole("region", { name: t(lang, "install.title") });

test("iPhone Safari: the language screen asks to install before sign-in, in the language picked", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "webkit", "Safari's engine, as on an iPhone");
  const context = await browser.newContext({ ...devices["iPhone 15"] });
  const page = await context.newPage();
  await page.goto(APP);
  await page.getByRole("radio", { name: new RegExp(`^${t(hi, "lang.hi")}`) }).check();

  const install = card(page, hi);
  await expect(install).toBeVisible();
  await expect(install).toContainText(t(hi, "install.ios"));
  await expect(install).toContainText(t(hi, "install.ios_first"));
  // Safari has no prompt to show: the card says what to tap instead.
  await expect(install.getByRole("button", { name: t(hi, "install.button") })).toHaveCount(0);

  await install.getByRole("button", { name: t(hi, "install.later") }).click();
  await expect(install).toBeHidden();
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeVisible();
  for (const lang of Lang.options) await expect(card(page, lang)).toHaveCount(0);
  await context.close();
});

test("Chrome: Settings shows Chrome's install prompt from a tap, and Not now stays hidden after a reload", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "beforeinstallprompt is Chrome's");
  const context = await browser.newContext();
  const page = await context.newPage();
  // With the manifest, Chrome could decide by itself that the page is installable; only the test's prompt may count.
  await page.route("**/manifest.webmanifest", (route) => route.abort());

  // Desktop Chrome with no prompt yet: nothing to offer before sign-in.
  await page.goto(APP);
  await expect(page.getByRole("radio").first()).toBeVisible();
  await expect(card(page, en)).toHaveCount(0);
  await signIn(page, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "HSR Layout" });

  // Chrome offers to install: the app keeps the event for its own button, and counts the prompts it shows.
  await page.evaluate(() => {
    const offer = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(offer, {
      prompt: async () => {
        Reflect.set(globalThis, "promptsShown", Number(Reflect.get(globalThis, "promptsShown") ?? 0) + 1);
      },
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    globalThis.dispatchEvent(offer);
  });
  await open(page, "nav.settings");
  const install = card(page, en);
  await install.getByRole("button", { name: t(en, "install.button") }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "promptsShown"))).toBe(1);
  // A prompt is shown once; turned down, the card falls back to the browser menu's words.
  await expect(install).toContainText(t(en, "install.manual"));

  await install.getByRole("button", { name: t(en, "install.later") }).click();
  await expect(install).toBeHidden();
  await page.reload();
  await expect(shell(page)).toBeVisible();
  await open(page, "nav.settings");
  await expect(page.getByRole("region", { name: t(en, "settings.look") })).toBeVisible();
  await expect(install).toHaveCount(0);
  await context.close();
});
