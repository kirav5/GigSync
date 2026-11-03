import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang, PROBLEM_HOLD_DAYS } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, reveal, shoot, signIn, statusTag } from "./helpers.js";
import { finishWork } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * Contact details deleted once a job is settled (ADR 0039 §3), through the app's screens against the real API: a
 * one-time job done and paid in cash loses the other side's card on both phones, with a quiet line in its place; and
 * "Report a problem" keeps them on both phones until one side marks it resolved.
 */

const { en } = Lang.enum;
const FOLDER = "contacts";
const say = (key: MessageKey, params?: Params) => t(en, key, params);

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

/** A carpenter in Jayanagar and a household there, both signed on one job; their names and the household's address. */
async function signedJob(workerPage: Page, householdPage: Page, tag: string) {
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const names = { worker: `Ganesh ${tag} ${RUN}`, household: `Lakshmi ${tag} ${RUN}` };
  const address = `No. 9, 4th Block (${tag} ${RUN})`;
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
    address,
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
  await expect(householdPage.getByLabel(say("a11y.contact"))).toContainText(names.worker);
  await expect(workerPage.getByLabel(say("a11y.contact"))).toContainText(address);
  return names;
}

const jobWith = (page: Page, name: string) => page.getByRole("article", { name: say("a11y.job_with", { name }) });

/** The worker marks the job done and records the cash she was paid at the door. */
async function doneAndCash(workerPage: Page, household: string) {
  const job = jobWith(workerPage, household);
  await finishWork(job);
  await expect(statusTag(job, en, "status.delivered")).toBeVisible();
  await job.getByRole("button", { name: say("getpaid.cash") }).click();
  await job.getByRole("button", { name: say("flag.yes"), exact: true }).click();
}

/** The job's card on this phone, wherever it is filed now, has no contact card and says they were removed. */
async function contactsGone(page: Page, name: string) {
  const job = jobWith(page, name);
  await reveal(page, job.getByText(say("contacts.removed")));
  await expect(job.getByLabel(say("a11y.contact"))).toHaveCount(0);
  await expect(job.getByRole("button", { name: say("problem.report") })).toHaveCount(0);
}

test("a one-time job done and paid: the contact details go from both phones, the job stays", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "Paid");
  await open(householdPage, "nav.my_jobs");
  await doneAndCash(workerPage, names.household);

  await contactsGone(workerPage, names.household);
  await contactsGone(householdPage, names.worker);
  // Whom it was with, the price and the money stay.
  const hers = jobWith(householdPage, names.worker);
  await expect(hers.getByLabel(say("a11y.deal"))).toBeVisible();
  await expect(hers.getByLabel(say("a11y.payment"))).toContainText(say("pay.thread.confirmed"));
  await shoot("settled", { worker: workerPage, household: householdPage }, FOLDER);
});

test("Report a problem keeps the contact details on both phones until it is resolved", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "Problem");
  await open(householdPage, "nav.my_jobs");
  const hers = jobWith(householdPage, names.worker);
  await hers.getByRole("button", { name: say("problem.report") }).click();
  const form = hers.getByRole("form", { name: say("problem.title") });
  await form.getByText(say("problem.reason.damage")).click();
  await form.getByLabel(say("problem.words")).fill("Scratched the floor");
  await form.getByRole("button", { name: say("problem.send") }).click();
  const reason = say("problem.reason.damage");
  await expect(hers).toContainText(say("problem.open_mine", { reason }));
  await expect(hers).toContainText(say("problem.holds", { days: PROBLEM_HOLD_DAYS }));

  const his = jobWith(workerPage, names.household);
  await expect(his).toContainText(say("problem.open_theirs", { name: names.household, reason }));
  await expect(his).toContainText("Scratched the floor");
  await doneAndCash(workerPage, names.household);
  const confirmed = (job: typeof his) =>
    job.getByLabel(say("a11y.payment")).filter({ hasText: say("pay.thread.confirmed") });
  await reveal(workerPage, confirmed(his));
  await reveal(householdPage, confirmed(hers));
  // Done and paid, but the problem holds them, on both phones.
  await reveal(workerPage, his.getByLabel(say("a11y.contact")));
  await reveal(householdPage, hers.getByLabel(say("a11y.contact")));
  await shoot("problem-holds", { worker: workerPage, household: householdPage }, FOLDER);

  await reveal(workerPage, his.getByRole("button", { name: say("problem.resolve") }));
  await his.getByRole("button", { name: say("problem.resolve") }).click();
  await contactsGone(workerPage, names.household);
  await contactsGone(householdPage, names.worker);
  await shoot("resolved", { worker: workerPage, household: householdPage }, FOLDER);
});
