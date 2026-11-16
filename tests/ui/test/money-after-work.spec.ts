import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, setUpi, signIn, statusTag } from "./helpers.js";
import { expand, finishWork } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * ADR 0054: a worker moves a signed job on one step at a time, and the money follows the work. Before the work is done
 * the card offers only the next step, Cancel and an advance; once the work has started Cancel becomes Stop, with a
 * reason the other phone reads; once it is done the worker asks for what is left.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const NOT_COMPLETED = new RegExp(t(en, "page.not_completed", { count: 0 }).split(" ·")[0] ?? "");

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function signedJob(browser: { newContext: () => Promise<BrowserContext> }, tag: string) {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [workerPage, householdPage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
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
  await setUpi(workerPage, en, "ganesh.test@okaxis");
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
  await signBoth({ worker, household }, "job-steps");
  const job = workerPage.getByRole("article", { name: say("a11y.job_with", { name: names.household }) });
  const hers = householdPage.getByRole("article", { name: say("a11y.job_with", { name: names.worker }) });
  return { workerPage, householdPage, job, hers, names };
}

test("the worker's card offers one step at a time, and asks for the money after the work", async ({ browser }) => {
  const { job, hers } = await signedJob(browser, "steps");
  const button = (key: MessageKey) => job.getByRole("button", { name: say(key), exact: true });

  // Signed: the first step, Cancel and an advance, and a quiet Mark done for a job done without the steps; not the
  // step in between, and no payment yet.
  await expect(button("update.on_my_way")).toBeVisible();
  await expect(button("restored.cancel")).toBeVisible();
  await expect(button("money.ask_advance")).toBeVisible();
  await expect(button("job.done_already")).toBeVisible();
  for (const key of ["job.start_work", "job.mark_done", "getpaid.cash"] as const)
    await expect(button(key)).toHaveCount(0);
  await expect(job.getByRole("button", { name: new RegExp(`^${say("money.ask_for", { price: "₹" })}`) })).toHaveCount(
    0,
  );

  // An advance over half the price is refused; one within it reaches her.
  await button("money.ask_advance").click();
  const amount = job.getByLabel(say("money.advance_amount"));
  await amount.fill("99999");
  await job
    .getByRole("form", { name: say("money.ask_advance") })
    .getByRole("button")
    .click();
  // The limit, which the form already says, now said again as the error.
  await expect(job.getByText(say("money.advance_cap", { price: "" }).trim().split(". ")[1] as string)).toHaveCount(2);
  await amount.fill("100");
  await job
    .getByRole("form", { name: say("money.ask_advance") })
    .getByRole("button")
    .click();
  await expect(hers.getByText(say("job.pay_advance", { price: "₹100" }))).toBeVisible();

  // Taken in cash, it does not settle the job: the steps go on, and Cancel becomes Stop once the work has started.
  await job.getByRole("button", { name: say("getpaid.cash") }).click();
  await job.getByRole("button", { name: say("flag.yes"), exact: true }).click();
  await button("update.on_my_way").click();
  await button("job.start_work").click();
  await expect(button("job.stop")).toBeVisible();
  await expect(button("restored.cancel")).toHaveCount(0);

  // Done: he asks for what is left.
  await finishWork(job);
  await expect(statusTag(job, en, "status.delivered")).toBeVisible();
  await expect(job.getByRole("button", { name: say("money.ask_balance", { price: "" }).trim() })).toBeVisible();
});

test("a job stopped after it started says why, on the other phone", async ({ browser }) => {
  const { householdPage, job, names } = await signedJob(browser, "stop");
  const button = (key: MessageKey) => job.getByRole("button", { name: say(key), exact: true });
  await button("update.on_my_way").click();
  await button("job.start_work").click();
  await button("job.stop").click();
  await button("stop.not_safe").click();
  await job.getByRole("button", { name: say("jobcard.stop_tell", { name: names.household }), exact: true }).click();
  // A job that ended leaves Activity for Records' Not completed.
  await open(householdPage, "nav.records");
  await expand(householdPage, NOT_COMPLETED);
  await expect(householdPage.getByText(say("job.stopped", { why: say("stop.not_safe") }))).toBeVisible();
});

test("a worker marks a signed job done in one tap, takes cash, and Earnings counts the job", async ({ browser }) => {
  const { workerPage, job, hers, names } = await signedJob(browser, "cash");
  const button = (key: MessageKey) => job.getByRole("button", { name: say(key), exact: true });

  // Straight from Agreed to Done: no On the way or Started first. Both phones say Done.
  await button("job.done_already").click();
  await expect(statusTag(job, en, "status.delivered")).toBeVisible();
  await expect(statusTag(hers, en, "status.delivered")).toBeVisible();

  // Paid in cash, said once and confirmed: the job is settled and leaves the open jobs.
  await job.getByRole("button", { name: say("getpaid.cash") }).click();
  await job.getByRole("button", { name: say("flag.yes"), exact: true }).click();
  await expect(job).toHaveCount(0);

  // Earnings lists it, with her name.
  await open(workerPage, "nav.records");
  await expect(workerPage.getByText(names.household).first()).toBeVisible();
});
