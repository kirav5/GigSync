import { mkdirSync } from "node:fs";
import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import {
  composer,
  composerButton,
  fakeSpeech,
  greeting,
  holdListening,
  listeningSheet,
  newChat,
  newPhone,
  profileButton,
  Role,
  RUN,
  SHOTS,
  signIn,
  tab,
  tabBar,
} from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * One Home for both owners, as the design's "Home · one ask box, a warm glow" draws it: the top bar (menu, the sun and
 * "gigsync", the profile, on one centre line), nothing until the greeting, the composer ("+", the enter button, the
 * small mic, the round voice button) and the three tabs, each in the same place on a worker's phone and a household's.
 * This is the test that finds the two drifting apart. Either mic opens the listening sheet: × drops the words, Done
 * ends the listen.
 */

const { en } = Lang.enum;
const say = (key: MessageKey) => t(en, key);
const PHONE = { width: 390, height: 844 };
/** How far apart the same part may sit on the two phones, in CSS pixels. */
const SLACK_PX = 2;
/** How far apart the top bar's three may sit from one centre line, in CSS pixels. */
const CENTRE_SLACK_PX = 1;
/** The composer's buttons, always there, left to right. */
const COMPOSER_BUTTONS: readonly MessageKey[] = ["composer.dictate", "speech.listen"];
const TABS: readonly MessageKey[] = ["nav.home", "nav.jobs", "nav.records"];
const BRAND = "gigsync";
/** What the fake recognizer hears on the household's taps: the small mic, the round button cancelled, then sent. */
const DICTATED = "A cook for two meals";
const CANCELLED = "Never mind";
const SPOKEN = "Help with housework";

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  contexts.push(context);
  return context.newPage();
}

const box = async (part: Locator) => {
  const found = await part.boundingBox();
  if (!found) throw new Error("A part of Home has no box: it is not on screen.");
  return found;
};

/** The parts of Home that must look the same for both owners. */
const parts = (page: Page) => ({
  topBar: page.getByRole("banner"),
  composer: composer(page),
  tabs: tabBar(page),
});

/** Home's structure, the same for both: the top bar's three, the greeting, the composer's buttons, the tabs. */
async function sameStructure(page: Page) {
  const bar = page.getByRole("banner");
  const menu = bar.getByRole("button", { name: say("chats.title"), exact: true });
  const brand = bar.getByText(BRAND, { exact: true });
  const [left, middle, right] = [await box(menu), await box(brand), await box(profileButton(page))];
  const order = [left, middle, right].map((b) => b.x);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // One centre line, and the two round buttons the same size.
  const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
  for (const b of [middle, right]) expect(Math.abs(centre(b) - centre(left))).toBeLessThanOrEqual(CENTRE_SLACK_PX);
  expect(right.width).toBe(left.width);
  await expect(greeting(page)).toBeVisible();
  const xs = [];
  for (const key of COMPOSER_BUTTONS) {
    const button = composerButton(page, key);
    await expect(button).toBeVisible();
    xs.push((await box(button)).x);
  }
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  await expect(tabBar(page).getByRole("button")).toHaveCount(TABS.length);
  for (const key of TABS) await expect(tab(page, key)).toBeVisible();
  await expect(tab(page, "nav.home")).toHaveAttribute("aria-current", "page");
}

/** Whatever is drawn between the top bar and the greeting: nothing, on Home. */
const between = (page: Page) =>
  page.evaluate(() => {
    const greet = document.querySelector(".greet");
    const content = document.querySelector("main.content");
    if (!greet || !content) return ["no greeting"];
    const top = greet.getBoundingClientRect().top;
    return Array.from(content.querySelectorAll("*"))
      .filter((el) => !el.contains(greet) && !greet.contains(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom <= top + 1 && getComputedStyle(el).visibility !== "hidden";
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
  });

/** Where this spec's pictures go: screenshots/<engine>/same-ui/. */
function shotsDir(): string {
  const dir = `${SHOTS}${test.info().project.name}/same-ui/`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Both Homes side by side in one picture, on a page of its own: the phones stay as they are for the cleanup. */
async function sideBySide(
  browser: { newContext: (o: object) => Promise<BrowserContext> },
  shots: Record<string, Buffer>,
) {
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  contexts.push(context);
  const page = await context.newPage();
  const imgs = Object.entries(shots)
    .map(([who, png]) => `<figure><img src="data:image/png;base64,${png.toString("base64")}"><p>${who}</p></figure>`)
    .join("");
  await page.setViewportSize({ width: PHONE.width * 2 + 48, height: PHONE.height + 60 });
  await page.setContent(
    `<body style="margin:0;display:flex;gap:16px;padding:16px;background:#efe8db;font:14px sans-serif">${imgs}</body>
     <style>figure{margin:0}img{width:${PHONE.width}px;display:block}p{margin:4px 0;text-align:center}</style>`,
  );
  await page.screenshot({ path: `${shotsDir()}home-worker-household.png` });
}

test("a worker's Home and a household's are the same screen: top bar, greeting, composer and tabs", async ({
  browser,
}) => {
  const [worker, household] = [await phone(browser), await phone(browser)];
  await signIn(worker, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone() });
  await publishCard(
    { page: worker, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: "Fans and switchboards" },
  );
  // The card chat she started on stays in her chats; a new one is Home's empty chat.
  await newChat(worker);
  await fakeSpeech(household, [DICTATED, CANCELLED, SPOKEN]);
  await holdListening(household);
  await signIn(household, { role: Role.consumer, name: `Priya ${RUN}`, phone: newPhone() });

  const shots: Record<string, Buffer> = {};
  for (const [who, page] of Object.entries({ worker, household })) {
    await expect(greeting(page)).toBeVisible();
    await sameStructure(page);
    expect(await between(page)).toEqual([]);
    shots[who] = await page.screenshot({ path: `${shotsDir()}home-${who}.png` });
  }
  for (const [name, part] of Object.entries(parts(worker))) {
    const [a, b] = [await box(part), await box(parts(household)[name as keyof ReturnType<typeof parts>])];
    for (const side of ["x", "y", "width", "height"] as const)
      expect(Math.abs(a[side] - b[side]), `${name} ${side}`).toBeLessThanOrEqual(SLACK_PX);
  }

  // As in Gemini, typing turns the round voice button into send on both; the small mic stays.
  for (const page of [worker, household]) {
    await expect(composerButton(page, "a11y.send")).toHaveCount(0);
    await composer(page).getByRole("textbox").fill("hello");
    await expect(composerButton(page, "a11y.send")).toBeEnabled();
    await expect(composerButton(page, "speech.listen")).toHaveCount(0);
    await expect(composerButton(page, "composer.dictate")).toBeVisible();
    await composer(page).getByRole("textbox").fill("");
    await expect(composerButton(page, "speech.listen")).toBeVisible();
  }
  // No "+" on either side: the quick picks are chips under each greeting.
  for (const page of [worker, household]) await expect(composer(page).getByRole("button")).toHaveCount(2);
  for (const key of ["need.pick_work", "home.my_places"] as const)
    await expect(household.locator(".greet").getByRole("button", { name: say(key), exact: true })).toBeVisible();
  // The small mic types by voice into the field and sends nothing; the round button listens and sends by itself. Each
  // opens the listening sheet with the words as they come; Done ends the listen and × drops it.
  const field = composer(household).getByRole("textbox");
  const sheet = listeningSheet(household);
  await composerButton(household, "composer.dictate").click();
  await expect(sheet).toContainText(DICTATED);
  await sheet.getByRole("button", { name: say("speech.done"), exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(field).toHaveValue(DICTATED);
  await expect(greeting(household)).toBeVisible();
  await field.fill("");
  await composerButton(household, "speech.listen").click();
  await expect(sheet).toContainText(CANCELLED);
  await sheet.getByRole("button", { name: say("speech.cancel"), exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(field).toHaveValue("");
  await expect(greeting(household)).toBeVisible();
  await composerButton(household, "speech.listen").click();
  await expect(sheet).toContainText(SPOKEN);
  await sheet.getByRole("button", { name: say("speech.done"), exact: true }).click();
  await expect(household.getByRole("log")).toContainText(SPOKEN);
  await sideBySide(browser, shots);
});
