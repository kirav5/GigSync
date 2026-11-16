import { type ApiClient, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { tellNeed } from "./findChat.js";
import {
  APP,
  completeSignIn,
  composerButton,
  counted,
  listWorker,
  newPhone,
  openCard,
  Role,
  RUN,
  tabBar,
} from "./helpers.js";

/**
 * A 360×640 phone, the small end of what pilot workers carry: on every screen with a dock, its one action is on
 * screen without scrolling; signed in, the tab bar is there; nothing scrolls sideways; and the type is the size the
 * rework set: body text at least 16px in English and a step larger in Hindi, buttons at least 16px. Lists to pick
 * from and checkboxes are 48px targets in every engine (WebKit draws a native select about 31px tall). The composer
 * keeps its four buttons on one line and its whole placeholder readable.
 */

const { en, hi } = Lang.enum;
const PHONE = { width: 360, height: 640 };
const BODY_MIN_PX: Readonly<Record<Lang, number>> = { en: 16, hi: 17, kn: 17 };
const BUTTON_MIN_PX = 16;
/** The rework's touch target (`--tap`). */
const TAP_PX = 48;
/** All of the action in sight: a button cut off at the screen's edge is as good as below it. */
const WHOLE = { ratio: 0.9 };
/** Somewhere quiet on the board, so the household's search finds this test's worker. */
const WHITEFIELD = { lat: 12.9698, lon: 77.75 };

test.use({ viewport: PHONE });

let other: ApiClient | undefined;
test.afterEach(async () => {
  await other?.removeProfile();
  other = undefined;
});

const fontPx = (l: Locator) => l.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

/** Every one of `targets` is at least a finger tall. */
async function tappable(targets: Locator) {
  const all = await targets.all();
  expect(all.length).toBeGreaterThan(0);
  for (const target of all) expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(TAP_PX);
}

/** The dock's action is on screen, the scrolling panel and the page are no wider than the phone, the type is big enough. */
async function fits(page: Page, action: Locator, lang: Lang, text: Locator = page.locator("body")) {
  await expect(action).toBeInViewport(WHOLE);
  const overflow = await page.evaluate(() => {
    const content = document.querySelector(".content");
    const page = document.documentElement;
    return Math.max(content ? content.scrollWidth - content.clientWidth : 0, page.scrollWidth - page.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await fontPx(text)).toBeGreaterThanOrEqual(BODY_MIN_PX[lang]);
}

/** The composer's buttons share one line, and its field shows the whole placeholder. */
async function composerFits(page: Page) {
  const fit = await page.locator("form.composer").evaluate((form) => {
    const input = form.querySelector("input");
    if (!input) return { tops: [], text: 1, room: 0 };
    const tops = Array.from(form.querySelectorAll(".composer-row > button"), (b) =>
      Math.round(b.getBoundingClientRect().top),
    );
    const style = getComputedStyle(input);
    const pen = document.createElement("canvas").getContext("2d");
    if (!pen) return { tops, text: 1, room: 0 };
    pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const room = input.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
    return { tops, text: pen.measureText(input.placeholder).width, room };
  });
  expect(new Set(fit.tops).size).toBe(1);
  expect(fit.text).toBeLessThanOrEqual(fit.room);
}

/** The language screen's row for `lang`, checked to fit: the screen is in the phone's own language (English) until a tap. */
async function pickLanguage(page: Page, lang: Lang): Promise<Locator> {
  const row = page.getByRole("button", { name: t(lang, `lang.${lang}`), exact: true });
  await fits(page, row, en, page.getByRole("region", { name: t(en, "onboard.title") }));
  return row;
}

/** Sign-in's first step: the welcome's Get started, which moves on to the number; the side is asked after the code. */
async function startSignIn(page: Page, lang: Lang) {
  await page.getByRole("button", { name: t(lang, "start.welcome_go"), exact: true }).click();
}

test("a worker's screens at 360×640 in English: Language, Sign-in, Talk and My card", async ({ page }) => {
  await page.goto(APP);
  await (await pickLanguage(page, en)).click();
  await startSignIn(page, en);

  await fits(page, page.getByRole("button", { name: t(en, "signin.send_code"), exact: true }), en);
  await completeSignIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone() });

  // With no card, she lands on Talk: the composer and its mic, and the tabs below, all on screen.
  await expect(tabBar(page)).toBeInViewport(WHOLE);
  await fits(page, page.getByRole("button", { name: t(en, "speech.listen") }), en);
  await expect(page.getByRole("form", { name: t(en, "nav.talk") })).toBeInViewport(WHOLE);
  await composerFits(page);
  // Typed words turn the round voice button into send, in the same place, whole at 360 px.
  await page
    .getByRole("form", { name: t(en, "nav.talk") })
    .getByRole("textbox")
    .fill("hello");
  await expect(page.getByRole("button", { name: t(en, "a11y.send"), exact: true })).toBeInViewport(WHOLE);
  await expect(page.getByRole("button", { name: t(en, "a11y.send"), exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: t(en, "speech.listen") })).toHaveCount(0);

  await openCard(page);
  const publish = page.getByRole("button", { name: t(en, "card.publish"), exact: true });
  await fits(page, publish, en);
  expect(await fontPx(publish)).toBeGreaterThanOrEqual(BUTTON_MIN_PX);
  await expect(page.getByRole("button", { name: t(en, "a11y.back"), exact: true })).toBeInViewport(WHOLE);
  // The area list, and each checkbox row ("sign for me" decides whether the agent signs alone).
  const card = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await tappable(card.getByRole("combobox"));
  await tappable(card.locator("label").filter({ has: page.getByRole("checkbox") }));
});

test("a household's screens at 360×640 in Hindi: Language, Sign-in and Find's Ask", async ({ page }) => {
  const name = `Layout ${RUN}`;
  other = await listWorker(name, ["painter"], WHITEFIELD, 80000, { area_name: "Whitefield", languages: [hi] });
  await page.goto(APP);
  await (await pickLanguage(page, hi)).click();
  await startSignIn(page, hi);

  await fits(page, page.getByRole("button", { name: t(hi, "signin.send_code"), exact: true }), hi);
  await completeSignIn(page, {
    role: Role.consumer,
    name: `Kavita ${RUN}`,
    phone: newPhone(),
    address: "Whitefield",
    lang: hi,
  });

  // Find's chat on a small phone: its choices are tappable, the found workers listed, and Ask reachable.
  await tappable(composerButton(page, "photo.add", hi));
  await composerFits(page);
  await tellNeed(
    { page, lang: hi },
    { trade: "painter", area: "Whitefield", need: t(hi, "trade.painter"), when: "when.today", budget: "8000" },
  );
  await expect(page.getByLabel(t(hi, "a11y.worker", { name }))).toBeVisible();
  const ask = page.getByRole("button", { name: counted(hi, "find.ask") });
  await fits(page, ask, hi);
  expect(await fontPx(ask)).toBeGreaterThanOrEqual(BUTTON_MIN_PX);
  await expect(tabBar(page, hi)).toBeInViewport(WHOLE);
});
