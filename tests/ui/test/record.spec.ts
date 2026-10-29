import { LOCALE, type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, openCard, Role, RUN, shoot, signIn } from "./helpers.js";
import { dealPaise, fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * The worker's record inside Passbook (round2-spec §2): a carpenter finishes a job both sides signed, and Passbook
 * shows it as work done, under its month, with where its money stands, even before anyone has asked for the money. The
 * row opens in place to the job's own card, whose money actions work from there. The month and the summary read in
 * the owner's language. Whitefield, so this worker shows among the household's results on a busy shared board.
 */

const { en, hi } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "record";

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** "October 2026" as the page's own browser formats it, so the engine's month names are the ones expected. */
const monthOnPage = (page: Page, lang: Lang) =>
  page.evaluate((locale) => new Date().toLocaleDateString(locale, { month: "long", year: "numeric" }), LOCALE[lang]);

/** ₹ as the app shows it (ui/places.ts `money`): Indian grouping, no paise when whole. */
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Passbook's "Work done" section, in the worker's language. */
const workDone = (page: Page, lang: Lang) => page.getByRole("region", { name: t(lang, "record.title") });

test("a finished job shows in Passbook's record under its month, and opens in place to the job", async ({
  browser,
}) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [workerPage, householdPage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const shots = { worker: workerPage, household: householdPage };
  const workerName = `Suresh ${RUN}`;
  const householdName = `Lata ${RUN}`;
  const address = `14, 2nd Main, ITPL Road, Whitefield (${RUN})`;

  // ── Nothing signed yet: Passbook says where money will show, and has no record ──────────────────────────────────
  await signIn(workerPage, { role: Role.worker, name: workerName, phone: newPhone() });
  await open(workerPage, "nav.passbook");
  await expect(workerPage.getByText(say("passbook.empty"))).toBeVisible();
  await expect(workDone(workerPage, en)).toHaveCount(0);

  // ── A household asks him for today; his agent asks what is wrong; both sign ────────────────────────────────────
  await publishCard(worker, {
    trade: say("trade.carpenter"),
    area: "whitefield",
    rate: "700",
    min: "550",
    about: "Doors, hinges and shelves",
  });
  await open(workerPage, "nav.today");
  await signIn(householdPage, { role: Role.consumer, name: householdName, phone: newPhone(), address });
  await fillAsk(household, {
    trade: "carpenter",
    area: "Whitefield",
    worker: workerName,
    need: "Bedroom door will not close",
    when: "when.today",
    budget: "650",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("The hinge is loose and the door drags");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await signBoth({ worker, household }, FOLDER);
  await expect(householdPage.getByLabel(say("a11y.contact"))).toContainText(workerName);
  const amount = rupees(await dealPaise(household));

  // ── Signed but not done: the record waits for it ────────────────────────────────────────────────────────────────
  await open(workerPage, "nav.passbook");
  await expect(workDone(workerPage, en)).toContainText(say("record.empty"));
  await expect(workerPage.getByText(say("passbook.empty"))).toHaveCount(0);

  // ── He marks it done; nobody has asked for the money yet ──────────────────────────────────────────────────────
  await open(workerPage, "nav.today");
  const card = workerPage.getByRole("article", { name: say("a11y.job_with", { name: householdName }) });
  await card.getByRole("button", { name: say("job.mark_done") }).click();
  await expect(card.getByText(say("status.delivered"), { exact: true })).toBeVisible();

  // ── Passbook: the summary, the month, and the job's row with its money state ───────────────────────────────────
  await open(workerPage, "nav.passbook");
  const month = await monthOnPage(workerPage, en);
  const summary = workerPage.getByText(plural(en, "record.jobs", 1));
  await expect(summary).toContainText(plural(en, "record.households", 1));
  await expect(summary).toContainText(say("record.since", { month }));
  const record = workDone(workerPage, en);
  await expect(record.getByRole("heading", { name: month, level: 3 })).toBeVisible();
  // Only the month's own rows: an open row's job card has lists of its own (notes, offers) that name her too.
  const rows = record.getByRole("list", { name: month }).locator(":scope > li");
  const row = rows.filter({ hasText: householdName });
  await expect(row).toHaveCount(1);
  for (const text of [amount, say("trade.carpenter"), say("record.state_not_asked")]) {
    await expect(row).toContainText(text);
  }
  await shoot("record-not-asked", shots, FOLDER);

  // ── The row opens in place to the job's own card, with its contact and money actions ───────────────────────────
  const show = row.getByRole("button", { name: say("record.open") });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await show.click();
  const hide = row.getByRole("button", { name: say("record.close") });
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  const job = row.getByRole("article", { name: say("a11y.job_with", { name: householdName }) });
  await expect(job.getByLabel(say("a11y.contact"))).toContainText(address);
  await shoot("record-open", shots, FOLDER);

  // She paid him in cash at the door: he records it from the open row, and the row says so at once.
  await job.getByRole("button", { name: say("getpaid.cash") }).click();
  await job.getByRole("button", { name: say("flag.yes"), exact: true }).click();
  await expect(row).toContainText(say("record.state_cash", { price: amount }));
  await expect(hide).toHaveAttribute("aria-expanded", "true");
  await expect(workerPage.getByText(say("passbook.week"), { exact: true }).locator("xpath=..")).toContainText(amount);
  await shoot("record-cash", shots, FOLDER);

  await hide.click();
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await expect(job).toHaveCount(0);

  // ── In Hindi: the same record, its month and summary in her phone's own words ──────────────────────────────────
  await open(workerPage, "nav.profile");
  await workerPage
    .getByRole("group", { name: say("a11y.language") })
    .getByRole("button", { name: say("lang.hi") })
    .click();
  await open(workerPage, "nav.passbook", hi);
  const hiMonth = await monthOnPage(workerPage, hi);
  const hiRecord = workDone(workerPage, hi);
  await expect(hiRecord.getByRole("heading", { name: hiMonth, level: 3 })).toBeVisible();
  await expect(workerPage.getByText(plural(hi, "record.jobs", 1))).toContainText(
    t(hi, "record.since", { month: hiMonth }),
  );
  await expect(hiRecord).toContainText(t(hi, "record.state_cash", { price: amount }));
  await expect(hiRecord.getByRole("button", { name: t(hi, "record.open") })).toHaveAttribute("aria-expanded", "false");
  await shoot("record-hindi", shots, FOLDER);

  // Back to English, so the clean-up finds its way, then the card comes off the board.
  await open(workerPage, "nav.profile", hi);
  await workerPage
    .getByRole("group", { name: t(hi, "a11y.language") })
    .getByRole("button", { name: t(hi, "lang.en") })
    .click();
  await openCard(workerPage);
  await workerPage.getByRole("button", { name: say("card.unlist") }).click();
  await open(workerPage, "nav.profile");
  await expect(workerPage.getByText(say("profile.card_off"))).toBeVisible();
});
