import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { chooseLanguage, DEV_OTP, newPhone, onScreen, open, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * Three screens redrawn in the kit, on a phone-sized screen: "What are you looking for?" keeps its two choices as
 * radios and sets them in the top part of the screen, not floating in its middle; Help's rows each open what they name
 * and its numbers are taps to call; and Moving to a new city starts from its city chips.
 */

const { en } = Lang.enum;
const FOLDER = "help-start";
const PHONE = { width: 390, height: 844 };
/** The choices must begin within this share of the screen's height, from the top. */
const CARDS_TOP_SHARE = 0.45;
const ARRIVAL = "2026-11-20";
/** The API's code-check window, plus a second (as helpers.ts waits it). */
const RATE_WINDOW_MS = 61_000;

test.use({ viewport: PHONE });

const topBarTitle = (page: Page) => page.locator(".topbar-title");

test("find work or find help sits in the top part of the screen and either card picks its side", async ({ page }) => {
  await chooseLanguage(page, en);
  await page.getByRole("button", { name: t(en, "start.welcome_go"), exact: true }).click();
  const form = page.getByRole("form", { name: t(en, "signin.label") });
  await form.getByLabel(t(en, "signin.phone")).fill(newPhone());
  await page.getByRole("button", { name: t(en, "signin.send_code"), exact: true }).click();
  const code = form.getByLabel(t(en, "signin.code"), { exact: true });
  await code.fill(DEV_OTP);

  const work = form.getByRole("radio", { name: t(en, "signin.worker"), exact: true });
  const help = form.getByRole("radio", { name: t(en, "signin.consumer"), exact: true });
  // The API takes 10 codes a minute from one address; after a busy run, wait the minute out and type it again.
  const tooMany = page.getByText(t(en, "net.too_many"));
  await expect(work.or(tooMany)).toBeVisible();
  if (await tooMany.isVisible()) {
    await page.waitForTimeout(RATE_WINDOW_MS);
    await code.fill(DEV_OTP);
  }
  await expect(work).toBeVisible();
  await expect(help).toBeVisible();
  await expect(page.getByText(t(en, "start.role_sub"))).toBeVisible();
  const first = await page.locator(".role-card").first().boundingBox();
  if (!first) throw new Error("the first choice has no box");
  expect(first.y).toBeLessThan(PHONE.height * CARDS_TOP_SHARE);
  await shoot("role", { phone: page }, FOLDER);

  await help.click();
  await expect(form.getByLabel(t(en, "signin.name"))).toBeVisible();
});

test("Help's rows open what they name, its numbers call, and a move starts from the city chips", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Helped ${RUN}`, phone: newPhone(), lang: en });
  await open(page, "me.help");
  await expect(page.getByRole("heading", { name: t(en, "me.help_title") })).toBeVisible();
  const numbers = page.getByRole("region", { name: t(en, "mentor.helplines") });
  // The numbers wait behind one row and slide open on a tap.
  const fold = numbers.getByRole("button", { name: new RegExp(t(en, "landing.lines_title")) });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(numbers.getByRole("link").first()).toBeVisible();
  await expect(numbers.getByRole("link").first()).toHaveAttribute("href", /^tel:\+?\d+$/);
  await shoot("help", { phone: page }, FOLDER);

  const row = (key: Parameters<typeof t>[1]) => page.getByRole("button", { name: t(en, key), exact: true });
  await row("mentor.find").click();
  await expect(topBarTitle(page)).toHaveText(t(en, "mentor.find"));

  await open(page, "me.help");
  await row("me.report").click();
  await onScreen(page, "nav.jobs");

  await open(page, "me.help");
  await row("records.terms_title").click();
  await expect(topBarTitle(page)).toHaveText(t(en, "records.terms_title"));

  // A union opens what the sources say in a sheet.
  await open(page, "me.help");
  const unions = page.getByRole("region", { name: t(en, "me.unions", { city: t(en, "landing.city.bengaluru") }) });
  await unions.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toContainText(t(en, "landing.source"));
  await page.getByRole("button", { name: t(en, "progress.done"), exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Moving to a new city: the start screen, then the journey.
  await row("me.moving").click();
  await expect(topBarTitle(page)).toHaveText(t(en, "landing.title"));
  const start = page.getByRole("form", { name: t(en, "landing.start_title") });
  await start.getByRole("button", { name: t(en, "landing.city.bengaluru"), exact: true }).click();
  await expect(page.getByText(t(en, "moving.checklist"), { exact: true })).toBeVisible();
  await start.getByLabel(t(en, "landing.arrival")).fill(ARRIVAL);
  await start.getByRole("button", { name: t(en, "trade.maid"), exact: true }).click();
  await shoot("moving-start", { phone: page }, FOLDER);
  await start.getByRole("button", { name: t(en, "landing.start") }).click();
  await expect(page.getByRole("region", { name: t(en, "landing.steps") })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(t(en, "landing.draft"));
  await shoot("journey", { phone: page }, FOLDER);
});
