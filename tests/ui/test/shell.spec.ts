import { HttpMethod, type MessageKey, t } from "@gigsync/core";
import { Lang, MyQr } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import {
  APP,
  chatList,
  newChat,
  newPhone,
  onScreen,
  open,
  Role,
  RUN,
  SHOTS,
  showChats,
  signIn,
  tab,
  tabBar,
  textOf,
} from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * The app's frame: four tabs at the foot of a tab's screen (Home, Jobs, Money and Me for a worker; Find, Jobs, Pay and
 * Me for a household), Back in the top bar on a screen opened from inside one, and the same tabs as a rail beside the
 * content on a wide screen. The chats are a screen of their own, with New chat. A waiting decision is a count on Jobs.
 */

const { en } = Lang.enum;
const say = (key: MessageKey) => t(en, key);
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };
const SCHEMES = ["light", "dark"] as const;
const MY_QR = /\/v1\/qr\/me$/;

/** What shows that each tab or Me row opened, for a worker and a household. */
const WORKER_SCREENS: readonly [MessageKey, (page: Page) => Locator][] = [
  ["nav.activity", (page) => page.getByRole("heading", { level: 1, name: say("activity.headline") })],
  ["nav.records", (page) => page.getByRole("heading", { level: 1, name: /₹/ })],
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

test("on a phone the tabs stand at the foot of a tab's screen; a screen inside one has Back instead", async ({
  browser,
}) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Shanti ${RUN}`, phone: newPhone() });
  for (const key of ["nav.home", "nav.jobs", "nav.money", "nav.me"] as const)
    await expect(tab(page, key)).toBeVisible();
  await shots(page, "01-phone-talk");

  await tab(page, "nav.me").click();
  await onScreen(page, "nav.me");
  await shots(page, "02-phone-me");
  await page.getByRole("button", { name: say("nav.card"), exact: true }).click();
  await onScreen(page, "nav.card");
  await expect(tabBar(page)).toBeHidden();
  await expect(page.getByRole("banner").getByRole("button", { name: say("a11y.back"), exact: true })).toBeVisible();
  await page.goBack();
  await onScreen(page, "nav.me");
  expect(page.url().startsWith(APP)).toBe(true);
});

test("a worker reaches every screen from the tabs and Me, and New chat opens an empty chat", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Gauri ${RUN}`, phone: newPhone() });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  for (const [row, shows] of WORKER_SCREENS) {
    await open(page, row);
    await expect(shows(page)).toBeVisible();
  }
  await shots(page, "03-phone-settings");
  await newChat(page);
  await expect(page.getByText(say("agent.empty"))).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(say("chats.new"));
  await showChats(page);
  await expect(chatList(page).getByRole("listitem")).toHaveCount(1);
});

test("a household reaches every screen from the tabs and Me, and New chat starts Find again", async ({ browser }) => {
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
  await page.getByRole("button", { name: say("group.home_repairs"), exact: true }).click();
  await page.getByRole("button", { name: say("trade.plumber"), exact: true }).click();
  await expect(log).toContainText(say("kind_ask.plumber"));
  await newChat(page);
  await expect(log).toContainText(say("need.start"));
  await expect(log).not.toContainText(say("kind_ask.plumber"));
  await expect(log.getByRole("button", { name: say("need.pick_work"), exact: true })).toBeVisible();
});

test("a waiting decision shows as a count on the Jobs tab, which leads to it", async ({ browser }) => {
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
  const jobs = tab(priya, "nav.jobs");
  await expect(jobs).toHaveAccessibleDescription("1");
  await shots(priya, "04-phone-need-you");
  await jobs.click();
  await onScreen(priya, "nav.activity");
  await expect(priya.getByRole("region", { name: say("activity.tab_awaiting"), exact: true })).toContainText("Arjun");
  await shots(priya, "05-phone-jobs-need-you");
});

test("on a wide screen the tabs stand as a rail beside the content", async ({ browser }) => {
  const page = await phone(browser, WIDE);
  await signIn(page, { role: Role.worker, name: `Wide ${RUN}`, phone: newPhone() });
  await expect(tabBar(page)).toBeVisible();
  const side = await tabBar(page).boundingBox();
  const content = await page.getByRole("main").boundingBox();
  expect(side?.x).toBe(0);
  expect((content?.x ?? 0) + 1).toBeGreaterThanOrEqual((side?.x ?? 0) + (side?.width ?? 0));
  await shots(page, "06-wide-talk");
  await open(page, "nav.about");
  await expect(tabBar(page)).toBeVisible();
  await expect(page.getByRole("region", { name: say("profile.language") })).toBeVisible();
  await shots(page, "07-wide-about");
});
