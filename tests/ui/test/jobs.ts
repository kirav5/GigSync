import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";
import { open } from "./menu.js";

/**
 * Job cards as the specs reach them: on the Jobs tab, where each job is one line that opens its card in place (Needs
 * you, Agents talking, Agreed), inside a card's folds, or on Money (Pay) once the job is finished.
 */

/** Opens the folded sections (Details, the agents' talks, Not completed) whose summary reads `summary`, inside `scope`. */
export async function expand(scope: Page | Locator, summary: MessageKey | RegExp, lang: Lang = DEFAULT_LANG) {
  const text = summary instanceof RegExp ? summary : t(lang, summary);
  await expect(scope.locator("summary").filter({ hasText: text }).first()).toBeVisible();
  for (const closed of await scope.locator("details:not([open]) > summary").filter({ hasText: text }).all()) {
    await closed.click();
  }
}

/** Opens every folded section on the page (the agents' talks, a job's details, Not completed). */
async function openFolds(page: Page) {
  await page.locator("details:not([open])").evaluateAll((folds) => {
    for (const fold of folds) if (fold instanceof HTMLDetailsElement) fold.open = true;
  });
}

/** Whether `target` shows once every fold is open. */
async function shows(page: Page, target: Locator): Promise<boolean> {
  await openFolds(page);
  return target.isVisible();
}

/**
 * Opens the closed job lines inside `scope`, one at a time, until `target` (when given) shows in a card. Each line
 * opened leaves the closed ones, so the first closed line is always the next; their count bounds the loop.
 */
async function openRows(page: Page, scope: Page | Locator, target?: Locator): Promise<boolean> {
  const closed = scope.locator('.job-row[aria-expanded="false"]');
  for (let left = await closed.count(); left > 0; left--) {
    // Pinned by its name's id: once open, `first()` already points at the next closed line.
    const named = await closed.first().getAttribute("aria-labelledby");
    if (!named) break;
    const row = scope.locator(`.job-row[aria-labelledby="${named}"]`);
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    if (target && (await shows(page, target))) return true;
  }
  return false;
}

/** Opens every closed job line on the Jobs tab, so each job's card shows. */
export const openAllRows = (page: Page) => openRows(page, page);

/** Opens Records' rows one at a time (only one stays open), until `target` shows in one of them. */
async function inRecords(page: Page, target: Locator): Promise<boolean> {
  const rows = page.locator(".record-line");
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
    if (await shows(page, target)) return true;
  }
  return false;
}

/** The Jobs tab's way to its finished jobs, on Money (Pay): named Closed jobs, its count beside the name. */
const closedJobs = (page: Page, lang: Lang) =>
  page.getByRole("button", { name: t(lang, "activity.tab_closed"), exact: true });

/**
 * Waits for `target` while the job may still move: between the Jobs tab's sections (a job waiting on the other side
 * goes to Agents talking, a signed one to Agreed), and out to Money (Pay) once it is finished. Each try opens every
 * folded section, then each closed job line in turn, then Money through Closed jobs and its rows, until it shows.
 */
export async function reveal(page: Page, target: Locator, lang: Lang = DEFAULT_LANG) {
  let inRecordsNow = false;
  await expect(async () => {
    if (inRecordsNow) await open(page, "nav.activity", lang);
    inRecordsNow = false;
    if (await shows(page, target)) return;
    if (await openRows(page, page, target)) return;
    const closed = closedJobs(page, lang);
    if ((await closed.count()) > 0 && Number(await closed.locator("b").textContent()) > 0) {
      await closed.click();
      inRecordsNow = true;
      if (await inRecords(page, target)) return;
    }
    await expect(target).toBeVisible({ timeout: 2_000 });
  }).toPass();
}

/**
 * Shows one of the Jobs tab's sections (Needs you, Agents talking, Agreed), named by its old tab key in the owner's
 * language: scrolls to it and opens its closed job lines, so its cards show as the tab's did.
 */
export async function showTab(page: Page, tab: MessageKey, lang: Lang = DEFAULT_LANG) {
  const section = page.getByRole("region", { name: t(lang, tab), exact: true });
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  await openRows(page, section);
}

/**
 * The job cards under one heading of the Jobs tab (a section, or one of a worker's days inside Agreed: Today's jobs,
 * Coming up, Other jobs): those whose nearest heading above is `heading`. Only open lines have a card; cards in a fold
 * are never under a heading.
 */
export function inSection(page: Page, heading: MessageKey, lang: Lang = DEFAULT_LANG): Locator {
  const title = t(lang, heading);
  const nearest = "preceding::*[self::h1 or self::h2 or self::h3][not(ancestor::article)][1]";
  return page.locator(
    `xpath=//article[not(ancestor::details)][${nearest}[starts-with(normalize-space(.), "${title}")]]`,
  );
}

/** The worker's steps on a signed job, in order: on the way, arrived and started, done. */
const WORK_STEPS: readonly MessageKey[] = ["update.on_my_way", "job.start_work", "job.mark_done"];

/**
 * Takes a signed job in `scope` through the worker's steps that are left, one tap at a time as the card offers them,
 * and ends with the work marked done. Each tap waits for the card to offer its next step; steps already taken (an
 * earlier "On my way") are never offered again, so they are skipped.
 */
export async function finishWork(scope: Locator, lang: Lang = DEFAULT_LANG) {
  const buttons = WORK_STEPS.map((key) => scope.getByRole("button", { name: t(lang, key), exact: true }));
  const [onMyWay, start, done] = buttons as [Locator, Locator, Locator];
  for (let taps = 0; taps < WORK_STEPS.length; taps++) {
    // Whichever step the card offers now: exactly one of them shows at a time.
    await expect(onMyWay.or(start).or(done)).toBeVisible();
    const step = (await onMyWay.isVisible()) ? onMyWay : (await start.isVisible()) ? start : done;
    await step.click();
    await expect(step).toBeHidden();
    if (step === done) return;
  }
}
