import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { completeSignIn, newPhone, open, Role, RUN, shoot, signIn, signOutHere } from "./helpers.js";
import { finishWork } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * One phone shared by two workers (one browser context), through the real screens and the real API. Suresh signs in,
 * finishes a job both sides signed, keeps what his agent remembers of it, then signs out; nothing is deleted. Kiran signs in on
 * the same phone and sees none of it: no job, no memory, empty Records. Kiran signs out, Suresh signs back in, and
 * it is all there again, his card included.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "shared-phone";
const suresh = { role: Role.worker, name: `Suresh ${RUN}`, phone: newPhone(), lang: en };
const kiran = { role: Role.worker, name: `Kiran ${RUN}`, phone: newPhone(), lang: en };
const householdName = `Lata ${RUN}`;

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

const jobWithLata = (page: Page) => page.getByRole("article", { name: say("a11y.job_with", { name: householdName }) });
const workDone = (page: Page) => page.getByRole("region", { name: say("record.title") });
const memory = (page: Page) => page.getByRole("region", { name: say("memory.title") });

async function signOut(page: Page) {
  await signOutHere(page);
  await expect(page.getByRole("form", { name: say("signin.label") })).toBeVisible();
}

/** Activity's Closed counter, which opens Records. */
const closedCount = (page: Page) => page.getByRole("button", { name: say("activity.tab_closed"), exact: true });

/** Suresh's finished job counted on Activity, its row in Records, and Lata in what his agent remembers. */
async function seesHisOwn(page: Page) {
  await open(page, "nav.activity");
  await expect(closedCount(page)).toContainText("1");
  await open(page, "nav.records");
  await expect(workDone(page)).toContainText(householdName);
  await expect(page.getByText(say("passbook.empty"))).toHaveCount(0);
  await open(page, "nav.about");
  await expect(memory(page)).toContainText(householdName);
}

test("two workers on one phone each see only their own jobs, memory and Records, and sign-out keeps them", async ({
  browser,
}) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [phonePage, householdPage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: phonePage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const shots = { phone: phonePage };

  // ── Suresh signs in, lists his card; Lata asks him; both sign ──────────────────────────────────────────────────
  await signIn(phonePage, suresh);
  await publishCard(worker, {
    trade: say("trade.carpenter"),
    area: "whitefield",
    rate: "700",
    min: "550",
    about: "Doors, hinges and shelves",
  });
  await open(phonePage, "nav.activity");
  await signIn(householdPage, {
    role: Role.consumer,
    name: householdName,
    phone: newPhone(),
    address: `7, 3rd Cross, Whitefield (${RUN})`,
  });
  await fillAsk(household, {
    trade: "carpenter",
    area: "Whitefield",
    worker: suresh.name,
    need: "Kitchen shelf is falling off",
    when: "when.today",
    budget: "650",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("The brackets came loose");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await signBoth({ worker, household }, FOLDER);
  await expect(jobWithLata(phonePage).getByLabel(say("a11y.contact"))).toBeVisible();
  // He does the job and she pays cash at the door: it is finished, so it moves to Records.
  await finishWork(jobWithLata(phonePage));
  await jobWithLata(phonePage)
    .getByRole("button", { name: say("getpaid.cash") })
    .click();
  await jobWithLata(phonePage)
    .getByRole("button", { name: say("flag.yes"), exact: true })
    .click();
  await expect(jobWithLata(phonePage)).toHaveCount(0);
  await seesHisOwn(phonePage);
  await shoot("suresh-before", shots, FOLDER);

  // ── Suresh signs out; Kiran signs in on the same phone and sees none of it ─────────────────────────────────────
  await signOut(phonePage);
  await completeSignIn(phonePage, kiran);
  await open(phonePage, "nav.activity");
  await expect(phonePage.getByText(say("activity.hint_worker"))).toBeVisible();
  // Nothing finished of his own: no Done section and no Closed jobs row (drawn only from one job up).
  await expect(closedCount(phonePage)).toHaveCount(0);
  await expect(phonePage.getByRole("region", { name: say("jobs.done"), exact: true })).toHaveCount(0);
  await expect(jobWithLata(phonePage)).toHaveCount(0);
  await open(phonePage, "nav.records");
  await expect(phonePage.getByText(say("passbook.empty"))).toBeVisible();
  await expect(workDone(phonePage)).toHaveCount(0);
  await open(phonePage, "nav.about");
  await expect(memory(phonePage)).toContainText(say("memory.empty"));
  await expect(memory(phonePage)).not.toContainText(householdName);
  await shoot("kiran", shots, FOLDER);

  // ── Kiran signs out; Suresh signs back in: his job, Records, memory and card are all there ────────────────────
  await signOut(phonePage);
  await completeSignIn(phonePage, suresh);
  // His card's rules came back with him: Today does not ask him to make a card.
  await open(phonePage, "nav.activity");
  await expect(phonePage.getByText(say("home.no_card"))).toHaveCount(0);
  await seesHisOwn(phonePage);
  await shoot("suresh-after", shots, FOLDER);
});
