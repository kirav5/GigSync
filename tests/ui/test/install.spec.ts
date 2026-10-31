import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, devices, expect, type Page, test } from "@playwright/test";
import { APP, drawer, newPhone, open, openDrawer, Role, RUN, SHOTS, signIn } from "./helpers.js";

/**
 * Installing the web app, as collab's Install panel. Before sign-in, on iPhone or where Chrome offered its prompt, the
 * language screen has a card (ui/InstallCard.tsx): the home-screen app keeps its own storage apart from Safari's.
 * Signed in, the menu's Install app shows Chrome's prompt where there is one, and otherwise opens the Install screen
 * (screens/pages/InstallPage.tsx) with the steps for this device and browser; Settings has one row to the same screen.
 */

const { en, hi } = Lang.enum;
const say = (key: MessageKey) => t(en, key);
const WIDE = { width: 1280, height: 800 };
/** WebKit on a Mac says it is Safari; the Install screen then says File › Add to Dock, not the address bar's icon. */
const MAC = /Macintosh/;
const WEBKIT = "webkit";

const card = (page: Page, lang: Lang) => page.getByRole("region", { name: t(lang, "install.title") });
const installScreen = (page: Page) => page.getByRole("region", { name: say("install.screen") });
const installButton = (page: Page) => drawer(page).getByRole("button", { name: say("install.button"), exact: true });
const back = (page: Page) => page.getByRole("banner").getByRole("button", { name: say("a11y.back"), exact: true });
/** Home is the chat: no × back to it. */
const atHome = (page: Page) =>
  expect(page.getByRole("button", { name: say("shell.to_chat"), exact: true })).toHaveCount(0);

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function signedIn(context: BrowserContext): Promise<Page> {
  contexts.push(context);
  const page = await context.newPage();
  // With the manifest, Chrome could decide by itself that the page is installable; only the test's prompt may count.
  await page.route("**/manifest.webmanifest", (route) => route.abort());
  await page.goto(APP);
  await signIn(page, { role: Role.worker, name: `Ravi ${RUN}`, phone: newPhone() });
  return page;
}

/** Saves the screen under screenshots/<engine>/install/. */
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}${test.info().project.name}/install/${name}.png` });
}

/** Expects the Install screen with `title` and exactly `steps`, in order, and `notice` under them when given. */
async function expectSteps(page: Page, title: MessageKey, steps: readonly MessageKey[], notice?: MessageKey) {
  await expect(page.getByRole("banner")).toContainText(say("install.screen"));
  const screen = installScreen(page);
  await expect(screen).toContainText(say(title));
  await expect(screen).toContainText(say("install.about"));
  await expect(screen.getByRole("listitem")).toHaveText(steps.map(say));
  if (notice) await expect(screen).toContainText(say(notice));
}

/** Chrome offers to install: the app keeps the event for its own button, and the page counts the prompts shown. */
async function offerPrompt(page: Page) {
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
}

test("iPhone Safari: the language screen asks to install before sign-in, in the language picked", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== WEBKIT, "Safari's engine, as on an iPhone");
  const context = await browser.newContext({ ...devices["iPhone 15"] });
  contexts.push(context);
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
});

test("iPhone: Install app opens the Install screen with Safari's steps, and Back returns to the chat", async ({
  browser,
}) => {
  const page = await signedIn(await browser.newContext({ ...devices["iPhone 15"] }));
  await openDrawer(page);
  await installButton(page).click();
  await expectSteps(
    page,
    "install.on_iphone",
    ["install.ios_share", "install.ios_add", "install.ios_keep", "install.ios_open"],
    "install.ios_apart",
  );
  // Safari never offers a prompt: nothing to press but its own Share.
  await expect(installScreen(page).getByRole("button")).toHaveCount(0);
  await shot(page, "iphone-safari");

  await back(page).click();
  await atHome(page);
});

test("Android: Install app opens the Install screen with Chrome's menu steps", async ({ browser }) => {
  const page = await signedIn(await browser.newContext({ ...devices["Pixel 7"] }));
  await openDrawer(page);
  await installButton(page).click();
  await expectSteps(page, "install.on_phone", ["install.android_menu", "install.android_pick", "install.android_open"]);
  await expect(installScreen(page)).not.toContainText(say("install.ios_apart"));
  await shot(page, "android");
});

test("a computer: Settings' row opens the address-bar steps; once Chrome offers, Install app shows its prompt", async ({
  browser,
  browserName,
}) => {
  const page = await signedIn(await browser.newContext({ viewport: WIDE }));
  const safari = browserName === WEBKIT && MAC.test(await page.evaluate(() => navigator.userAgent));

  // Settings has one way to it: a row, not a card of its own.
  await open(page, "nav.settings");
  await expect(card(page, en)).toHaveCount(0);
  await shot(page, "settings-row");
  await page.getByRole("button", { name: new RegExp(say("install.screen")) }).click();
  const steps: readonly MessageKey[] = safari
    ? ["install.mac_dock", "install.mac_add", "install.computer_open"]
    : ["install.computer_icon", "install.computer_add", "install.computer_open"];
  await expectSteps(page, "install.on_computer", steps);
  await shot(page, safari ? "mac-safari" : "computer");
  await back(page).click();
  await atHome(page);

  // Chrome offers to install: the menu's button shows the prompt itself, and no screen opens.
  await offerPrompt(page);
  await installButton(page).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "promptsShown"))).toBe(1);
  await expect(installScreen(page)).toHaveCount(0);
  await atHome(page);

  // A prompt is shown once; turned down, the same button opens the steps instead.
  await installButton(page).click();
  await expect(installScreen(page)).toBeVisible();
});

test("Chrome with a prompt: the Install screen leads with Chrome's own button", async ({ browser }) => {
  const page = await signedIn(await browser.newContext({ viewport: WIDE }));
  await open(page, "nav.settings");
  await offerPrompt(page);
  await page.getByRole("button", { name: new RegExp(say("install.screen")) }).click();
  const button = installScreen(page).getByRole("button", { name: say("install.button"), exact: true });
  await expect(button).toBeVisible();
  await shot(page, "prompt");
  await button.click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "promptsShown"))).toBe(1);
  await expect(button).toHaveCount(0);
});
