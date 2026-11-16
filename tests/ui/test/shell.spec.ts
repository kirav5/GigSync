import { HttpMethod, type MessageKey, t } from "@gigsync/core";
import { Lang, MyQr } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import {
  APP,
  chatList,
  composerButton,
  greeting,
  homePick,
  newChat,
  newPhone,
  onScreen,
  open,
  profileButton,
  profileSheet,
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
 * The app's frame: three tabs at the foot of a tab's screen (Home, Jobs, and Earnings or Payments; a household's Home is
 * Find), Back in the top bar on a screen opened from inside one, the owner's pages in the profile sheet from the round
 * button at the top right, and the same tabs as a rail beside the content on a wide screen. The chats are a screen of
 * their own, with New chat, behind the round button at the top left. A waiting decision is a count on Jobs.
 */

const { en } = Lang.enum;
const say = (key: MessageKey) => t(en, key);
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };
const SCHEMES = ["light"] as const;
const MY_QR = /\/v1\/qr\/me$/;

/** What shows that each tab or profile row opened, for a worker and a household. */
const WORKER_SCREENS: readonly [MessageKey, (page: Page) => Locator][] = [
  ["nav.activity", (page) => page.getByRole("heading", { level: 1, name: say("activity.headline") })],
  ["nav.records", (page) => page.getByRole("heading", { level: 1, name: /₹/ })],
  ["nav.card", (page) => page.getByRole("region", { name: say("page.card_seen") })],
  ["nav.about", (page) => page.getByRole("form", { name: say("settings.paid_to") })],
  ["nav.privacy", (page) => page.getByRole("region", { name: say("records.privacy_title") })],
  ["nav.settings", (page) => page.getByRole("region", { name: say("me.this_phone") })],
];
const HOUSEHOLD_SCREENS: readonly [MessageKey, (page: Page) => Locator][] = [
  ["nav.activity", (page) => page.getByRole("heading", { level: 1, name: say("activity.headline") })],
  ["nav.records", (page) => page.getByText(say("page.records_empty"))],
  ["nav.card", (page) => page.getByRole("region", { name: say("qr.mine") })],
  ["nav.about", (page) => page.getByRole("region", { name: say("memory.title") })],
  ["me.language", (page) => page.getByRole("region", { name: say("profile.language") })],
  ["nav.privacy", (page) => page.getByRole("region", { name: say("records.privacy_title") })],
  ["nav.settings", (page) => page.getByRole("region", { name: say("me.this_phone") })],
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

/** Saves the screen in the light look, under screenshots/<engine>/shell/. */
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
  for (const key of ["nav.home", "nav.jobs", "nav.earnings"] as const) await expect(tab(page, key)).toBeVisible();
  // Three tabs only: the owner's pages are in the profile, behind the round button with their initial.
  await expect(tabBar(page).getByRole("button")).toHaveCount(3);
  await expect(profileButton(page)).toBeVisible();
  await shots(page, "01-phone-talk");

  await profileButton(page).click();
  await onScreen(page, "profile.title");
  await shots(page, "02-phone-profile");
  await profileSheet(page)
    .getByRole("button", { name: say("nav.card"), exact: true })
    .click();
  await expect(profileSheet(page)).toBeHidden();
  await onScreen(page, "nav.card");
  await expect(tabBar(page)).toBeHidden();
  await expect(page.getByRole("banner").getByRole("button", { name: say("a11y.back"), exact: true })).toBeVisible();
  // Back comes to where she opened the profile from: Talk, where she landed.
  await page.goBack();
  await onScreen(page, "nav.talk");
  expect(page.url().startsWith(APP)).toBe(true);

  // A tab is a top place, as Home is: the tab bar moves between them, and its top bar has no Back.
  for (const key of ["nav.jobs", "nav.earnings"] as const) {
    await tab(page, key).click();
    await onScreen(page, key);
    await expect(page.getByRole("banner").getByRole("button", { name: say("a11y.back"), exact: true })).toHaveCount(0);
  }
});

test("a worker reaches every screen from the tabs and the profile, and New chat opens an empty chat", async ({
  browser,
}) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Gauri ${RUN}`, phone: newPhone() });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  for (const [row, shows] of WORKER_SCREENS) {
    await open(page, row);
    await expect(shows(page)).toBeVisible();
  }
  await shots(page, "03-phone-settings");
  await newChat(page);
  // Home is the new chat: the brand in the top bar and the greeting, as a household's.
  await expect(greeting(page)).toBeVisible();
  await expect(page.getByText(say("agent.empty"))).toBeVisible();
  await showChats(page);
  await expect(chatList(page).getByRole("listitem")).toHaveCount(1);
});

test("a household reaches every screen from the tabs and the profile, and New chat starts Find again", async ({
  browser,
}) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.consumer, name: `Rekha ${RUN}`, phone: newPhone(), address: "HSR Layout" });
  const log = page.getByRole("log");
  await expect(greeting(page)).toBeVisible();
  for (const [row, shows] of HOUSEHOLD_SCREENS) {
    await open(page, row);
    await expect(shows(page)).toBeVisible();
  }
  await expect(page.getByRole("form", { name: say("settings.paid_to") })).toHaveCount(0);
  await open(page, "nav.find");
  // ADR 0051: the list of work is one pick behind the composer's "+", not the trades themselves.
  await homePick(page, "need.pick_work");
  await page.getByRole("button", { name: say("group.home_repairs"), exact: true }).click();
  await page.getByRole("button", { name: say("trade.plumber"), exact: true }).click();
  await expect(log).toContainText(say("kind_ask.plumber"));
  await newChat(page);
  await expect(greeting(page)).toBeVisible();
  await expect(page.getByText(say("kind_ask.plumber"))).toHaveCount(0);
  // A household's "+" is the photo picker itself.
  await expect(composerButton(page, "photo.add")).toBeVisible();
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
  await open(page, "me.language");
  await expect(tabBar(page)).toBeVisible();
  await expect(page.getByRole("region", { name: say("profile.language") })).toBeVisible();
  await shots(page, "07-wide-about");
});

/** The sheet's panel: its edges, and the name of each animation running on it (paused at `at` ms when given). */
const panelNow = (page: Page, at?: number) =>
  page.locator(".sheet-panel").evaluate((panel, ms) => {
    const running = panel.getAnimations();
    for (const a of running) {
      if (ms === undefined) continue;
      a.pause();
      a.currentTime = ms;
    }
    const box = panel.getBoundingClientRect();
    const names = running.map((a) => (a instanceof CSSAnimation ? a.animationName : ""));
    return { top: box.top, bottom: box.bottom, names, height: window.innerHeight };
  }, at);

test("the profile sheet slides up from the bottom edge, and back down on Done", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Rise ${RUN}`, phone: newPhone() });
  await profileButton(page).click();
  // Held at its first frame, the panel sits wholly below the screen; let go, it ends flush with the bottom edge.
  const start = await panelNow(page, 0);
  expect(start.names).toContain("sheet-rise");
  expect(start.top).toBeGreaterThanOrEqual(start.height - 1);
  await page.locator(".sheet-panel").evaluate((panel) => {
    for (const a of panel.getAnimations()) a.finish();
  });
  const end = await panelNow(page);
  expect(Math.abs(end.bottom - end.height)).toBeLessThanOrEqual(2);
  // Done slides it back down before the dialog closes.
  await profileSheet(page)
    .getByRole("button", { name: say("profile.done"), exact: true })
    .click();
  await expect.poll(async () => (await panelNow(page)).names).toContain("sheet-sink");
  await expect(profileSheet(page)).toBeHidden();
});
