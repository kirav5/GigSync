import { type MessageKey, plural, questionText, RecordsAnswer, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  chooseLanguage,
  completeSignIn,
  MovePrompt,
  newPhone,
  open,
  Role,
  RUN,
  reveal,
  SHOTS,
  signIn,
} from "./helpers.js";
import { finishWork } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";
import { seedServedJobs } from "./record-seed.js";
import {
  blockConsent,
  consentAccepted,
  downloadRecord,
  expectAgreed,
  storedAnswer,
  unblockConsent,
} from "./records.js";

/**
 * Job records kept by GigSync (ADR 0038), through the app's screens against the real API: the line under Continue on
 * the sign-in screen (ADR 0039 §4), its placeholder for the documents, and the agreement it records; the one line an
 * owner signed in before it sees once; "My work record" pulled from the server and downloaded; "Delete my records
 * from GigSync"; and a job whose household deleted theirs, which still counts for the worker, marked as confirmed by
 * the worker only. A whole job both phones confirmed is in two-users.spec.ts.
 */

const { en, hi, kn } = Lang.enum;
const PHONE = { width: 390, height: 844 };
const TALL_PHONE = { width: PHONE.width, height: 1400 };
const FOLDER = "records";
/** How long the worker's lone job may take to reach his record, and how long each look at it waits. */
const ONE_SIDED_MS = 120_000;
const RETRY_STEP_MS = 5_000;
/** Three jobs done for two households; rated 5, 4 and 5. */
const RATED = [
  { household: 1, stars: 5 },
  { household: 1, stars: 4 },
  { household: 2, stars: 5 },
];

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, acceptDownloads: true });
  contexts.push(context);
  return context.newPage();
}

async function shot(page: Page, name: string) {
  await page.setViewportSize(TALL_PHONE);
  await page.screenshot({ path: `${SHOTS}${test.info().project.name}/${FOLDER}/${name}.png` });
  await page.setViewportSize(PHONE);
}

const button = (page: Page, lang: Lang, key: MessageKey) =>
  page.getByRole("button", { name: t(lang, key), exact: true });
const privacy = (page: Page, lang: Lang) => page.getByRole("region", { name: t(lang, "records.privacy_title") });

/** A worker whose number already has these jobs kept by GigSync, signed in on the app with a card on the board. */
async function seededCook(page: Page, name: string) {
  const number = newPhone();
  await seedServedJobs(number, RATED);
  // Seeding signed the number in on another device, so the move prompt comes; this cook is not moving.
  await signIn(page, { role: Role.worker, name, phone: number, elsewhere: MovePrompt.notNow });
  await publishCard(
    { page, lang: en },
    { trade: "Cook", area: "jayanagar", rate: "11000", min: "9000", about: "Home food" },
  );
}

test("the sign-in line in Hindi opens the terms; continuing records the agreement on GigSync", async ({ browser }) => {
  const worker = await phone(browser);
  const who = { role: Role.worker, name: `Sunita ${RUN}`, phone: newPhone(), lang: hi };
  await chooseLanguage(worker, hi);
  const form = worker.getByRole("form", { name: t(hi, "signin.label") });
  await form.getByRole("radio", { name: t(hi, `signin.${who.role}`), exact: true }).click();
  await form.getByLabel(t(hi, "signin.name")).fill(who.name);
  // One line under Continue, the documents' name a link inside it.
  const link = worker.getByRole("button", { name: t(hi, "records.signin_link"), exact: true });
  const sentence = t(hi, "records.signin_line", { link: t(hi, "records.signin_link") });
  await expect(link.locator("xpath=..")).toHaveText(sentence);
  await shot(worker, "signin-line-hi");
  await link.click();
  const terms = worker.getByRole("region", { name: t(hi, "records.terms_title") });
  await expect(terms).toContainText(t(hi, "records.terms_writing"));
  await expect(terms).toContainText(t(hi, "records.notice_never"));
  await shot(worker, "terms-placeholder-hi");
  await button(worker, hi, "records.terms_back").click();
  // What she typed is still there.
  await expect(form.getByLabel(t(hi, "signin.name"))).toHaveValue(who.name);

  const accepted = consentAccepted(worker);
  await completeSignIn(worker, who);
  await accepted;
  await expectAgreed(worker);
  await open(worker, "nav.privacy", hi);
  await expect(privacy(worker, hi)).toContainText(t(hi, "records.privacy_kept"));
  // No screen in the way, and no line either: she agreed on the sign-in screen.
  await expect(worker.getByText(t(hi, "records.consent_toast"))).toHaveCount(0);
});

test("an owner signed in before the line has it recorded once on opening, with one line about Settings", async ({
  browser,
}) => {
  const household = await phone(browser);
  // As an older app: nothing about the agreement reaches GigSync at sign-in.
  await blockConsent(household);
  await signIn(household, {
    role: Role.consumer,
    name: `Kamala ${RUN}`,
    phone: newPhone(),
    address: "Jayanagar",
    lang: kn,
  });
  expect(await storedAnswer(household)).toBeUndefined();
  await unblockConsent(household);
  const accepted = consentAccepted(household);
  await household.reload();
  await accepted;
  const toast = household.getByRole("status").filter({ hasText: t(kn, "records.consent_toast") });
  await expect(toast).toBeVisible();
  await shot(household, "consent-line-kn");
  await expectAgreed(household);
  await open(household, "nav.settings", kn);
  // The row's name is its title and the line under it.
  await household.getByRole("button", { name: t(kn, "records.terms_title") }).click();
  await expect(household.getByRole("region", { name: t(kn, "records.terms_title") })).toContainText(
    t(kn, "records.terms_writing"),
  );
  // Once: opening again says nothing.
  await household.reload();
  await expect(household.getByRole("banner")).toBeVisible();
  await expect(toast).toHaveCount(0);
});

test("Download my work record, one quiet row in Records, pulls the record from GigSync as a file", async ({
  browser,
}) => {
  const page = await phone(browser);
  await seededCook(page, `Revathi ${RUN}`);
  await open(page, "nav.records");
  await expect(page.getByText(t(en, "records.download_about"))).toBeVisible();
  await shot(page, "work-record");
  const { file, lines } = await downloadRecord(page);
  expect(lines[0]).toBe("Date,Work,Price (₹),Received (₹),Paid by,Status,Confirmed by,Stars");
  expect(lines.slice(1).map((l) => l.split(",").slice(1, 3).concat(l.split(",").slice(5)))).toEqual([
    ["Cook", "11000.00", "Done", "Both", "5"],
    ["Cook", "11000.00", "Done", "Both", "4"],
    ["Cook", "11000.00", "Done", "Both", "5"],
  ]);
  await expect(page.getByRole("status").filter({ hasText: file })).toHaveText(t(en, "records.downloaded", { file }));
});

test("Delete my records from GigSync says what goes, then the card's record is zero and nothing is kept", async ({
  browser,
}) => {
  const page = await phone(browser);
  await seededCook(page, `Nirmala ${RUN}`);
  await open(page, "nav.card");
  const mine = page.getByRole("region", { name: t(en, "page.card_seen") });
  await expect(mine.getByRole("definition")).toHaveText(["3", t(en, "record.card_stars", { stars: "4.7" })]);

  await open(page, "nav.privacy");
  const section = privacy(page, en);
  await section.getByRole("button", { name: t(en, "records.delete") }).click();
  const confirm = section.getByRole("dialog", { name: t(en, "records.delete") });
  await expect(confirm).toContainText(t(en, "records.delete_confirm_worker"));
  await shot(page, "delete-confirm");
  await confirm.getByRole("button", { name: t(en, "records.delete_yes") }).click();
  await expect(section.getByRole("status")).toHaveText(t(en, "records.deleted"));
  await expect(section).toContainText(t(en, "records.privacy_off"));
  await expect(section.getByRole("button", { name: t(en, "records.privacy_agree") })).toBeVisible();

  await open(page, "nav.card");
  await expect(mine.getByRole("definition")).toHaveText(["0", t(en, "record.card_no_stars")]);
  // Opening the app again records nothing: the owner chose to stop, and Privacy offers it again.
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByText(t(en, "records.consent_toast"))).toHaveCount(0);
  expect(await storedAnswer(page)).toBe(RecordsAnswer.withdrawn);
  await open(page, "nav.privacy");
  await expect(section).toContainText(t(en, "records.privacy_off"));
});

test("a household deleted its records; the worker's job still counts, marked as confirmed by the worker only", async ({
  browser,
}) => {
  const [workerPage, householdPage] = [await phone(browser), await phone(browser)];
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const workerName = `Imran ${RUN}`;
  await signIn(workerPage, { role: Role.worker, name: workerName, phone: newPhone() });
  await publishCard(worker, {
    trade: t(en, "trade.carpenter"),
    area: "koramangala",
    rate: "700",
    min: "550",
    about: "Doors and shelves",
  });
  await open(workerPage, "nav.activity");

  const who = { role: Role.consumer, name: `Meera ${RUN}`, phone: newPhone(), address: `Koramangala (${RUN})` };
  await signIn(householdPage, who);
  // She deletes her records with GigSync before asking: her phone sends nothing about the job.
  await open(householdPage, "nav.privacy");
  const hers = privacy(householdPage, en);
  await hers.getByRole("button", { name: t(en, "records.delete") }).click();
  await hers.getByRole("button", { name: t(en, "records.delete_yes") }).click();
  await expect(hers.getByRole("status")).toHaveText(t(en, "records.deleted"));
  await open(householdPage, "nav.find");
  await fillAsk(household, {
    trade: "carpenter",
    area: "Koramangala",
    worker: workerName,
    need: "Need a carpenter",
    when: "when.today",
    budget: "650",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: t(en, "a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("The door drags");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();
  await signBoth({ worker, household }, FOLDER);

  // He does the job. Only his phone sent it; GigSync keeps it as his once her signature reached him, and once done it
  // counts on his card.
  await open(workerPage, "nav.activity");
  const job = workerPage.getByRole("article", { name: t(en, "a11y.job_with", { name: who.name }) });
  await reveal(workerPage, job.getByRole("button", { name: t(en, "update.on_my_way") }));
  await finishWork(job);
  const mine = workerPage.getByRole("region", { name: t(en, "page.card_seen") });
  await expect(async () => {
    // Opened afresh each time: the card's record is read again when My card opens.
    await open(workerPage, "nav.activity");
    await open(workerPage, "nav.card");
    await expect(mine.getByRole("definition").first()).toHaveText("1", { timeout: RETRY_STEP_MS });
  }).toPass({ timeout: ONE_SIDED_MS });
  await open(workerPage, "nav.records");
  const { lines } = await downloadRecord(workerPage);
  expect(lines.slice(1).map((l) => l.split(",").slice(5, 7))).toEqual([["Done", "You only"]]);
  await shot(workerPage, "one-sided");
});
