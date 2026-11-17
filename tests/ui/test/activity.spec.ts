import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { newPhone, onScreen, open, openCard, Role, RUN, shoot, showTab, signIn, statusTag } from "./helpers.js";
import { finishWork } from "./jobs.js";
import { dealPaise, fillAsk, type Phone, publishCard, unlistCards } from "./journey.js";

/**
 * The Jobs tab (both owners, one frame), an activity page: sections one under the other, each drawn only while it has
 * jobs, each job a compact card (the person, the work, a status pill, when, the amount). One job walks through them:
 * the deal to sign waits under Needs you; signed by one side it moves to Agents talking while the other signs; signed
 * by both it is Agreed, under its day; done and paid (and, for the household, reviewed) it moves to Done, under the
 * day it was finished, and is counted under Closed jobs at the foot, which opens Money (Pay) where it is kept.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "activity";
/** The kit's white card, as the browser reports it. */
const WHITE = "rgb(255, 255, 255)";

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** One of the sections, by its heading. */
const section = (page: Page, key: MessageKey) => page.getByRole("region", { name: say(key), exact: true });
/** The open sections, each named by its heading: an empty one is not drawn. */
const OPEN_SECTIONS = ["activity.tab_awaiting", "activity.tab_talks", "activity.tab_agreed"] as const;
/** A job card's face in a section: its status pill and the amount across from the name. */
const pill = (scope: Locator) => scope.locator(".job-pill");
const amountOn = (scope: Locator) => scope.locator(".job-row-amount");
/** Closed: the count at the foot, which opens Money (Pay). */
const closed = (page: Page) => page.getByRole("button", { name: say("activity.tab_closed"), exact: true });
const signGroup = (page: Page) => page.getByRole("group", { name: say("a11y.sign") });
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Folds every open job card back to its face. */
async function closeRows(page: Page) {
  const open = page.locator('.job-row[aria-expanded="true"]');
  for (let left = await open.count(); left > 0; left--) await open.first().click();
  await expect(open).toHaveCount(0);
}

/** Expects Closed to read `count`. */
const counts = (counter: Locator, count: number) => expect(counter.locator("b")).toHaveText(String(count));
/** Expects a section to list `count` jobs. */
const lists = (page: Page, key: MessageKey, count: number) =>
  expect(section(page, key).locator(".job-rows > li")).toHaveCount(count);

test("a job walks from Awaiting you to In talks to Agreed, then leaves Activity for Records", async ({ browser }) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [workerPage, householdPage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const shots = { worker: workerPage, household: householdPage };
  const workerName = `Ganesh ${RUN}`;
  const householdName = `Rekha ${RUN}`;

  // ── Nothing yet: Home is the chat; Jobs has every section empty, and what to ask in the chat ─────────────────
  await signIn(workerPage, { role: Role.worker, name: workerName, phone: newPhone() });
  await publishCard(worker, {
    trade: say("trade.carpenter"),
    area: "whitefield",
    rate: "700",
    min: "550",
    about: "Doors, windows and cupboards",
  });
  await open(workerPage, "nav.home");
  await onScreen(workerPage, "nav.talk");
  await open(workerPage, "nav.activity");
  await expect(workerPage.getByRole("heading", { level: 1, name: say("activity.headline") })).toBeVisible();
  // Nothing at all: no section is drawn, nor Closed jobs; one card says so, with what to ask in the chat.
  for (const key of [...OPEN_SECTIONS, "jobs.done"] as const) await expect(section(workerPage, key)).toHaveCount(0);
  await expect(closed(workerPage)).toHaveCount(0);
  await expect(workerPage.getByText(say("jobs.empty"), { exact: true })).toBeVisible();
  await expect(workerPage.getByText(say("activity.hint_worker"))).toBeVisible();
  await expect(workerPage.getByRole("button", { name: /Agent log/ })).toHaveCount(0);

  // ── The household asks him; its agent answers his agent's question; the agents agree ───────────────────────────
  await signIn(householdPage, {
    role: Role.consumer,
    name: householdName,
    phone: newPhone(),
    address: `21, 4th Cross, Whitefield (${RUN})`,
  });
  await fillAsk(household, {
    trade: "carpenter",
    area: "Whitefield",
    worker: workerName,
    need: "Need a carpenter",
    when: "when.today",
    budget: "650",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("The cupboard door has come off");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await open(householdPage, "nav.activity");

  // ── Needs you: whichever owner's agent accepted first is asked to sign, its line open on the deal ──────────────
  await expect(async () => {
    const seen = await Promise.all([workerPage, householdPage].map((p) => signGroup(p).isVisible()));
    expect(seen.some(Boolean)).toBe(true);
  }).toPass();
  const first = (await signGroup(workerPage).isVisible()) ? workerPage : householdPage;
  const second = first === workerPage ? householdPage : workerPage;
  await lists(first, "activity.tab_awaiting", 1);
  await expect(section(first, "activity.tab_awaiting").getByRole("group", { name: say("a11y.sign") })).toBeVisible();
  // Its card: the one move as a rust pill, the price to sign across from the name.
  await expect(pill(section(first, "activity.tab_awaiting"))).toHaveText(say("jobs.word.sign"));
  await expect(amountOn(section(first, "activity.tab_awaiting"))).toHaveText(/^₹[\d,]+$/);
  // The kit's colours: the card keeps the light line (a terracotta bar marks it), and the amount is a light card.
  const needsCard = section(first, "activity.tab_awaiting").locator(".job-rows > li");
  await expect(needsCard).toHaveCSS("background-image", /linear-gradient/);
  await expect(signGroup(first).locator(".sign-hero")).toHaveCSS("background-color", WHITE);
  await shoot("awaiting-you", shots, FOLDER);

  // ── Agents talking: signed by one side, it waits for the other's signature ────────────────────────────────────
  await signGroup(first)
    .getByRole("button", { name: /^Sign deal for/ })
    .click();
  await lists(first, "activity.tab_awaiting", 0);
  await lists(first, "activity.tab_talks", 1);
  await showTab(first, "activity.tab_talks");
  await expect(statusTag(section(first, "activity.tab_talks"), en, "status.confirming")).toBeVisible();
  await expect(pill(section(first, "activity.tab_talks"))).toHaveText(say("status.confirming"));
  await expect(signGroup(second)).toBeVisible();
  await lists(second, "activity.tab_awaiting", 1);
  await shoot("in-talks", shots, FOLDER);

  // ── Agreed: both signed, on both phones; his is one of today's jobs ───────────────────────────────────────────
  await signGroup(second)
    .getByRole("button", { name: /^Sign deal for/ })
    .click();
  for (const page of [workerPage, householdPage]) {
    await lists(page, "activity.tab_agreed", 1);
    await lists(page, "activity.tab_talks", 0);
    await showTab(page, "activity.tab_agreed");
  }
  const job = workerPage.getByRole("article", { name: say("a11y.job_with", { name: householdName }) });
  await expect(
    section(workerPage, "activity.tab_agreed").getByRole("heading", { name: say("schedule.today") }),
  ).toBeVisible();
  await expect(job.getByLabel(say("a11y.contact"))).toBeVisible();
  const amount = rupees(await dealPaise(household));
  // His card: the price both signed, and the next move for today as the pill.
  await expect(amountOn(section(workerPage, "activity.tab_agreed"))).toHaveText(amount);
  await expect(pill(section(workerPage, "activity.tab_agreed"))).toHaveText(say("jobs.word.set_off"));
  await shoot("agreed", shots, FOLDER);
  // Folded, each job is one compact card: the page at a glance. Opened again for the steps that follow.
  for (const page of [workerPage, householdPage]) await closeRows(page);
  await shoot("agreed-at-a-glance", shots, FOLDER);
  for (const page of [workerPage, householdPage]) await showTab(page, "activity.tab_agreed");

  // ── Handed over but not paid: still Agreed. Paid in cash at the door: it moves to Done, today, paid in green ───
  await finishWork(job);
  await expect(statusTag(job, en, "status.delivered")).toBeVisible();
  await lists(workerPage, "activity.tab_agreed", 1);
  await job.getByRole("button", { name: say("getpaid.cash") }).click();
  await job.getByRole("button", { name: say("flag.yes"), exact: true }).click();
  await expect(job).toHaveCount(0);
  await expect(section(workerPage, "activity.tab_agreed")).toHaveCount(0);
  await counts(closed(workerPage), 1);
  await lists(workerPage, "jobs.done", 1);
  const done = section(workerPage, "jobs.done");
  await expect(done.getByRole("heading", { name: say("schedule.today"), exact: true })).toBeVisible();
  await expect(done.locator(".job-pill.paid")).toBeVisible();
  await expect(amountOn(done)).toHaveText(amount);
  await shoot("worker-activity", { worker: workerPage }, FOLDER);

  // ── Closed opens Money: the job, done and paid, under its month ───────────────────────────────────────────────
  await closed(workerPage).click();
  await onScreen(workerPage, "nav.records");
  const workDone = workerPage.getByRole("region", { name: say("record.title") });
  const row = workDone.locator(".record-list > li").filter({ hasText: householdName });
  await expect(row).toContainText(say("record.state_cash", { price: amount }));
  await expect(workerPage.getByRole("button", { name: say("records.download_title"), exact: true })).toBeVisible();
  await shoot("worker-records", { worker: workerPage }, FOLDER);

  // ── The household: paid, the job waits for her review under Agreed; reviewed, it goes to Done and Pay ──────────
  const hers = householdPage.getByRole("article", { name: say("a11y.job_with", { name: workerName }) });
  const review = hers.getByRole("form", { name: say("a11y.review") });
  await expect(review).toBeVisible();
  await review.getByLabel(say("a11y.review_text")).fill("Fixed it in an hour");
  await review.getByRole("button", { name: say("job.send_review") }).click();
  await expect(hers).toHaveCount(0);
  await counts(closed(householdPage), 1);
  await lists(householdPage, "jobs.done", 1);
  await expect(householdPage.getByText(say("activity.hint_household"))).toHaveCount(0);
  await shoot("household-activity", { household: householdPage }, FOLDER);
  await closed(householdPage).click();
  await onScreen(householdPage, "nav.records");
  const paidRow = householdPage.locator(".record-list > li").filter({ hasText: workerName });
  await expect(paidRow).toContainText(say("trade.carpenter"));
  await expect(paidRow).toContainText(say("page.paid", { price: amount }));
  await shoot("household-records", { household: householdPage }, FOLDER);

  // The card comes off the board so later runs start clean.
  await openCard(workerPage);
  await workerPage.getByRole("button", { name: say("card.unlist") }).click();
  await open(workerPage, "nav.card");
  await expect(workerPage.getByText(say("profile.card_off"))).toBeVisible();
});
