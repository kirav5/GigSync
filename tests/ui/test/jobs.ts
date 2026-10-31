import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";
import { open } from "./menu.js";

/**
 * Job cards as the specs reach them: in Activity's tabs (Awaiting you, In talks, Agreed), inside a card's folds, or
 * in Records once the job is finished.
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

/**
 * Waits for `target` while the job may still move: between Activity's tabs (a job waiting on the other side goes to
 * In talks, a signed one to Agreed), and out to Records once it is finished. Each try opens every folded section,
 * then each tab in turn, then Records (through Closed) and its rows, until it shows.
 */
export async function reveal(page: Page, target: Locator, lang: Lang = DEFAULT_LANG) {
  let inRecordsNow = false;
  await expect(async () => {
    if (inRecordsNow) await open(page, "nav.activity", lang);
    inRecordsNow = false;
    if (await shows(page, target)) return;
    for (const tab of await page.getByRole("tab").all()) {
      await tab.click();
      if (await shows(page, target)) return;
    }
    const closed = page.locator(".radar-count.closed");
    if ((await closed.count()) > 0 && Number(await closed.locator("b").textContent()) > 0) {
      await closed.click();
      inRecordsNow = true;
      if (await inRecords(page, target)) return;
    }
    await expect(target).toBeVisible({ timeout: 2_000 });
  }).toPass();
}

/** Opens one of Activity's tabs (Awaiting you, In talks, Agreed) by its name in the owner's language. */
export async function showTab(page: Page, tab: MessageKey, lang: Lang = DEFAULT_LANG) {
  const button = page.getByRole("tab", { name: t(lang, tab), exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-selected", "true");
}

/**
 * The job cards under one heading of Activity's Agreed tab (Today's jobs, Coming up, Other jobs, or a household's Your
 * jobs): those whose nearest section heading above is `heading`. Cards in a fold are never under a heading.
 */
export function inSection(page: Page, heading: MessageKey, lang: Lang = DEFAULT_LANG): Locator {
  const title = t(lang, heading);
  const nearest = "preceding::*[self::h1 or self::h2 or self::h3][not(ancestor::article)][1]";
  return page.locator(
    `xpath=//article[not(ancestor::details)][${nearest}[starts-with(normalize-space(.), "${title}")]]`,
  );
}
