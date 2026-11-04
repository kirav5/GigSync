import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, reveal, shoot, signIn, statusTag, textOf } from "./helpers.js";
import { expand } from "./jobs.js";
import { fillAsk, type Phone, publishCard, unlistCards } from "./journey.js";

/**
 * The people take over from their agents (ADR 0053 §4–5), through the real screens and API: a household's budget far
 * below a carpenter's lowest rate, five offers each and no meeting, and the job waits for both owners with what each
 * may do. Ending it ends it on both phones, and the household can ask him again from Records.
 */

const { en } = Lang.enum;
const FOLDER = "take-over";
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const NOT_COMPLETED = new RegExp(t(en, "page.not_completed", { count: 0 }).split(" ·")[0] ?? "");

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

const jobWith = (page: Page, name: string) => page.getByRole("article", { name: say("a11y.job_with", { name }) });

test("after three offers each without a deal, the carpenter decides, and ending the talk ends it for both", async ({
  browser,
}) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [workerPage, homePage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: homePage, lang: en };
  const names = { worker: `Imran ${RUN}`, household: `Kavya ${RUN}` };
  await signIn(workerPage, { role: Role.worker, name: names.worker, phone: newPhone() });
  await publishCard(worker, {
    trade: t(en, "trade.carpenter"),
    area: "jayanagar",
    rate: "1500",
    min: "1200",
    about: "Doors",
  });
  await open(workerPage, "nav.activity");
  await signIn(homePage, {
    role: Role.consumer,
    name: names.household,
    phone: newPhone(),
    address: "No. 4, 9th Block",
    area: "Jayanagar",
  });
  // Her most is well under his lowest: the agents can never meet.
  await fillAsk(household, {
    trade: "carpenter",
    area: "Jayanagar",
    worker: names.worker,
    need: "Need a carpenter",
    when: "when.tomorrow",
    budget: "500",
  });
  await homePage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = homePage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("Wardrobe door off its hinge");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();

  // Her agent spoke last after five offers each: she is told, and may take his last price, but it is his turn.
  await open(homePage, "nav.activity");
  const hers = jobWith(homePage, names.worker);
  const waits = hers.getByRole("group", { name: say("a11y.takeover") });
  await reveal(homePage, waits);
  await expect(waits).toContainText(say("decide.takeover_title"));
  await expect(waits.getByRole("button", { name: textOf(en, "decide.accept_theirs") })).toBeVisible();
  await expect(waits.getByLabel(say("decide.your_offer"))).toHaveCount(0);

  // The carpenter's agent made its five offers: the job is his to decide, under Awaiting you. Before a deal he knows
  // her only as a customer.
  await open(workerPage, "nav.activity");
  const job = jobWith(workerPage, say("job.customer"));
  const decide = job.getByRole("group", { name: say("a11y.takeover") });
  await reveal(workerPage, decide);
  await expect(decide).toContainText(say("decide.takeover_title"));
  await expect(decide.getByRole("button", { name: say("decide.end"), exact: true })).toBeVisible();
  await expect(decide.getByLabel(say("decide.your_offer"))).toBeVisible();
  await shoot("take-over", { worker: workerPage, household: homePage }, FOLDER);

  await decide.getByRole("button", { name: say("decide.end"), exact: true }).click();
  // An ended talk leaves Activity for Records' Not completed, on both phones.
  for (const page of [workerPage, homePage]) {
    await open(page, "nav.records");
    await expand(page, NOT_COMPLETED);
    const notCompleted = page.locator("details").filter({ hasText: NOT_COMPLETED });
    await expect(statusTag(notCompleted.getByRole("article").first(), en, "status.cancelled")).toBeVisible();
  }
  // She can ask him again, in a new chat that asks the time and budget afresh (ADR 0053 §5).
  const ended = homePage.locator("details").filter({ hasText: NOT_COMPLETED }).getByRole("article").first();
  await expect(ended.getByRole("button", { name: say("job.find_another"), exact: true })).toBeVisible();
  await ended.getByRole("button", { name: say("job.ask_again", { name: names.worker }), exact: true }).click();
  await expect(homePage.getByRole("log")).toContainText(say("need.start_to", { name: names.worker }));
});
