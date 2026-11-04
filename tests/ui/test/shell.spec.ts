import { HttpMethod, type MessageKey, plural, t } from "@gigsync/core";
import { Lang, MyQr } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import {
  APP,
  drawer,
  menuButton,
  navRow,
  newPhone,
  onScreen,
  open,
  openDrawer,
  Role,
  RUN,
  SHOTS,
  signIn,
  textOf,
} from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * The app's frame, as the collab app's: a menu with GigSync's logo and what runs the agent, New chat, six screens, the
 * chats and the foot, a drawer on a phone (☰ opens it; ×, Escape and Back close it) and a column beside the content
 * on a wide screen. The chat is home. "N need you »" shows while a decision waits, with a dot on ☰ and a pill above.
 */

const { en } = Lang.enum;
const say = (key: MessageKey) => t(en, key);
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };
const SCHEMES = ["light", "dark"] as const;
const MY_QR = /\/v1\/qr\/me$/;

/** What shows that each screen of the menu opened, for a worker and a household. */
const WORKER_SCREENS: readonly [MessageKey, (page: Page) => Locator][] = [
  ["nav.activity", (page) => page.getByRole("heading", { level: 1, name: say("activity.headline") })],
  ["nav.records", (page) => page.getByRole("heading", { level: 1, name: new RegExp(`^${say("nav.records")}`) })],
  ["nav.card", (page) => page.getByRole("region", { name: say("page.card_seen") })],
  ["nav.about", (page) => page.getByRole("form", { name: say("settings.paid_to") })],
  ["nav.privacy", (page) => page.getByRole("region", { name: say("records.privacy_title") })],
  ["nav.settings", (page) => page.getByRole("region", { name: say("settings.look") })],
];
const HOUSEHOLD_SCREENS: readonly [MessageKey, (page: Page) => Locator][] = [
  ["nav.activity", (page) => page.getByRole("heading", { level: 1, name: say("activity.headline") })],
  ["nav.records", (page) => page.getByText(say("page.records_empty"))],
  ["nav.card", (page) => page.getByRole("region", { name: say("qr.mine") })],
  ["nav.about", (page) => page.getByRole("region", { name: say("profile.language") })],
  ["nav.privacy", (page) => page.getByRole("region", { name: say("records.privacy_title") })],
  ["nav.settings", (page) => page.getByRole("region", { name: say("settings.look") })],
];

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }, size = PHONE): Promise<Page> {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  contexts.push(context);
  return context.newPage();
}

/** Saves the screen in both looks, under screenshots/<engine>/shell/. */
async function shots(page: Page, name: string) {
  const dir = `${SHOTS}${test.info().project.name}/shell/`;
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: `${dir}${name}-${colorScheme}.png` });
  }
  await page.emulateMedia({ colorScheme: null });
}

test("on a phone the menu is a drawer: ☰ opens it, ×, Escape and Back close it, and focus goes in and back", async ({
  browser,
}) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Shanti ${RUN}`, phone: newPhone() });
  const menu = menuButton(page);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(drawer(page)).toBeHidden();
  await shots(page, "01-phone-talk");

  await menu.click();
  await expect(drawer(page)).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(navRow(page, "nav.activity")).toBeFocused();
  await expect(drawer(page).getByRole("button", { name: say("chats.new"), exact: true })).toBeVisible();
  await expect(drawer(page).getByRole("button", { name: say("shell.sign_out"), exact: true })).toBeVisible();
  await shots(page, "02-phone-menu");
  await drawer(page)
    .getByRole("button", { name: say("shell.close_menu") })
    .click();
  await expect(drawer(page)).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page.goBack();
  await expect(drawer(page)).toBeHidden();
  expect(page.url().startsWith(APP)).toBe(true);
});

test("a worker reaches every screen from the menu, and New chat opens an empty chat", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Gauri ${RUN}`, phone: newPhone() });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  for (const [row, shows] of WORKER_SCREENS) {
    await open(page, row);
    await expect(shows(page)).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(say(row));
  }
  await shots(page, "03-phone-settings");
  await open(page, "nav.talk");
  await openDrawer(page);
  await drawer(page)
    .getByRole("button", { name: say("chats.new"), exact: true })
    .click();
  await expect(page.getByText(say("agent.empty"))).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(say("chats.new"));
  await openDrawer(page);
  await expect(
    drawer(page)
      .getByRole("region", { name: say("chats.title") })
      .getByRole("listitem"),
  ).toHaveCount(1);
});

test("a household reaches every screen from the menu, and New chat starts Find again", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.consumer, name: `Rekha ${RUN}`, phone: newPhone(), address: "HSR Layout" });
  const log = page.getByRole("log");
  await expect(log).toContainText(say("need.start"));
  for (const [row, shows] of HOUSEHOLD_SCREENS) {
    await open(page, row);
    await expect(shows(page)).toBeVisible();
  }
  await expect(page.getByRole("form", { name: say("settings.paid_to") })).toHaveCount(0);
  await open(page, "nav.find");
  // ADR 0051: the opening has one chip to the list of work, not the trades themselves.
  await page.getByRole("button", { name: say("need.pick_work"), exact: true }).click();
  await page.getByRole("button", { name: say("trade.plumber"), exact: true }).click();
  await expect(log).toContainText(say("question.problem"));
  await openDrawer(page);
  await drawer(page)
    .getByRole("button", { name: say("chats.new"), exact: true })
    .click();
  await expect(log).toContainText(say("need.start"));
  await expect(log).not.toContainText(say("question.problem"));
  await expect(log.getByRole("button", { name: say("need.pick_work"), exact: true })).toBeVisible();
});

test("a waiting decision shows as N need you in the menu, a dot on ☰ and a pill above, each leading to Activity", async ({
  browser,
}) => {
  const [anil, priya] = [await phone(browser), await phone(browser)];
  const anilName = `Arjun ${RUN}`;
  const priyaName = `Priya Shell ${RUN}`;
  await signIn(anil, { role: Role.worker, name: anilName, phone: newPhone() });
  await publishCard(
    { page: anil, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: "Fans and switchboards" },
  );
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: "HSR Layout" });
  const mine = priya.waitForResponse((r) => MY_QR.test(r.url()) && r.request().method() === HttpMethod.put && r.ok());
  await open(priya, "nav.card");
  const { code } = MyQr.parse(await (await mine).json());
  await open(priya, "nav.find");

  // Anil scans her QR and offers to work: a decision waits on her phone.
  await anil.goto(`${APP}/?to=${code}`);
  await anil.getByRole("button", { name: t(en, "qr.offer", { name: "Priya" }) }).click();
  const needs = plural(en, "shell.need_you", 1);
  const pill = priya.getByRole("banner").getByRole("button", { name: needs });
  await expect(pill).toBeVisible();
  await expect(menuButton(priya).locator(".menu-dot")).toBeVisible();
  await shots(priya, "04-phone-need-you");
  await openDrawer(priya);
  await expect(navRow(priya, "nav.activity")).toContainText("1");
  await shots(priya, "05-phone-menu-need-you");
  await drawer(priya)
    .getByRole("button", { name: `${needs} »` })
    .click();
  await onScreen(priya, "nav.activity");
  await expect(pill).toHaveCount(0);
  await open(priya, "nav.find");
  await pill.click();
  await onScreen(priya, "nav.activity");
});

test("on a wide screen the menu stands beside the content, with no ☰", async ({ browser }) => {
  const page = await phone(browser, WIDE);
  await signIn(page, { role: Role.worker, name: `Wide ${RUN}`, phone: newPhone() });
  await expect(drawer(page)).toBeVisible();
  await expect(menuButton(page)).toHaveCount(0);
  const side = await drawer(page).boundingBox();
  const content = await page.getByRole("main").boundingBox();
  expect(side?.x).toBe(0);
  expect((content?.x ?? 0) + 1).toBeGreaterThanOrEqual((side?.x ?? 0) + (side?.width ?? 0));
  await shots(page, "06-wide-talk");
  await open(page, "nav.about");
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByRole("region", { name: say("profile.language") })).toBeVisible();
  await shots(page, "07-wide-about");
});
