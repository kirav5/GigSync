import { type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { open, progressStep, shoot, statusTag } from "./helpers.js";
import { expand } from "./jobs.js";
import { unlistCards } from "./journey.js";
import { signedJob } from "./signed-job.js";

/**
 * A signed job's moves: the worker takes one step at a time (on the way, then arrived and started, then done), each
 * showing on both progress lines; and either side may cancel the job until the work is handed over, after a second
 * tap, which ends it on both phones.
 */

const { en } = Lang.enum;
const FOLDER = "job-steps";
/** Records' fold of jobs that were cancelled, declined or expired, whatever its count. */
const NOT_COMPLETED = new RegExp(t(en, "page.not_completed", { count: 0 }).split(" ·")[0] ?? "");
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const button = (scope: Locator, key: MessageKey) => scope.getByRole("button", { name: say(key), exact: true });

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function pages(browser: { newContext: () => Promise<BrowserContext> }): Promise<[Page, Page]> {
  contexts = [await browser.newContext(), await browser.newContext()];
  return (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
}

const jobWith = (page: Page, name: string) => page.getByRole("article", { name: say("a11y.job_with", { name }) });

test("the worker moves a signed job on one step at a time, and both progress lines follow", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "steps", FOLDER);
  const job = jobWith(workerPage, names.household);

  // Agreed: only "On my way" is offered, beside Cancel.
  await expect(button(job, "update.on_my_way")).toBeVisible();
  await expect(button(job, "job.start_work")).toHaveCount(0);
  await expect(button(job, "job.mark_done")).toHaveCount(0);
  await expect(button(job, "restored.cancel")).toBeVisible();
  await shoot("agreed", { worker: workerPage }, FOLDER);

  await button(job, "update.on_my_way").click();
  await expect(button(job, "job.start_work")).toBeVisible();
  await expect(button(job, "update.on_my_way")).toHaveCount(0);
  await expect(button(job, "job.mark_done")).toHaveCount(0);
  await expect(progressStep(householdPage, en, "progress.on_my_way")).toHaveAttribute("aria-current", "step");
  await shoot("on-the-way", { worker: workerPage, household: householdPage }, FOLDER);

  await button(job, "job.start_work").click();
  await expect(button(job, "job.mark_done")).toBeVisible();
  await expect(button(job, "job.start_work")).toHaveCount(0);
  // Started: Cancel is now Stop, with a reason (ADR 0054).
  await expect(button(job, "job.stop")).toBeVisible();
  await expect(button(job, "restored.cancel")).toHaveCount(0);
  await expect(progressStep(householdPage, en, "progress.started")).toHaveAttribute("aria-current", "step");
  await shoot("started", { worker: workerPage, household: householdPage }, FOLDER);

  await button(job, "job.mark_done").click();
  await expect(statusTag(job, en, "status.delivered")).toBeVisible();
  // Handed over: nothing left to cancel or stop.
  await expect(button(job, "restored.cancel")).toHaveCount(0);
  await expect(button(job, "job.stop")).toHaveCount(0);
});

test("the household cancels a signed job after a second tap, and it ends on both phones", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "cancel", FOLDER);
  await open(householdPage, "nav.activity");
  const hers = jobWith(householdPage, names.worker);
  await expect(button(hers, "update.on_my_way")).toHaveCount(0);
  await button(hers, "restored.cancel").click();
  await expect(hers.getByRole("group", { name: say("restored.cancel_sure") })).toBeVisible();
  await shoot("cancel-sure", { household: householdPage }, FOLDER);
  await button(hers, "restored.cancel_yes").click();
  // A cancelled job leaves Activity for Records' Not completed, on both phones. The worker's card no longer names
  // her: a cancel drops the other side's contact card (ADR 0039 §3).
  for (const page of [householdPage, workerPage]) {
    await open(page, "nav.records");
    await expand(page, NOT_COMPLETED);
    const notCompleted = page.locator("details").filter({ hasText: NOT_COMPLETED });
    await expect(statusTag(notCompleted.getByRole("article").first(), en, "status.cancelled")).toBeVisible();
  }
  await shoot("cancelled", { worker: workerPage, household: householdPage }, FOLDER);
});
