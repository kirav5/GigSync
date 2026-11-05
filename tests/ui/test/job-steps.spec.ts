import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { newPhone, open, progressStep, Role, RUN, shoot, signIn, statusTag } from "./helpers.js";
import { expand } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

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

/** A carpenter in Jayanagar and a household there, both signed on one job; their names. */
async function signedJob(workerPage: Page, householdPage: Page, tag: string) {
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const names = { worker: `Ganesh ${tag} ${RUN}`, household: `Lakshmi ${tag} ${RUN}` };
  await signIn(workerPage, { role: Role.worker, name: names.worker, phone: newPhone() });
  await publishCard(worker, {
    trade: t(en, "trade.carpenter"),
    area: "jayanagar",
    rate: "800",
    min: "600",
    about: "Doors and cupboards",
  });
  await open(workerPage, "nav.activity");
  await signIn(householdPage, {
    role: Role.consumer,
    name: names.household,
    phone: newPhone(),
    address: `No. 9, 4th Block (${tag} ${RUN})`,
    area: "Jayanagar",
  });
  await fillAsk(household, {
    trade: "carpenter",
    area: "Jayanagar",
    worker: names.worker,
    need: "Need a carpenter",
    when: "when.today",
    budget: "750",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("Cupboard door hangs loose");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await signBoth({ worker, household }, FOLDER);
  return names;
}

const jobWith = (page: Page, name: string) => page.getByRole("article", { name: say("a11y.job_with", { name }) });

test("the worker moves a signed job on one step at a time, and both progress lines follow", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "steps");
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
  const names = await signedJob(workerPage, householdPage, "cancel");
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
