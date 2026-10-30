import { readFileSync } from "node:fs";
import { type MessageKey, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { MovePrompt, newPhone, open, Role, RUN, SHOTS, signIn } from "./helpers.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";
import { seedServedJobs } from "./record-seed.js";
import { NoticeAnswer } from "./records.js";

/**
 * Job records kept by GigSync (ADR 0038), through the app's screens against the real API: the notice at sign-up for
 * a worker and a household, in their language; "My work record" pulled from the server and downloaded; and "Delete my
 * records from GigSync"; and a job whose household said Not now, which still counts for the worker, marked as
 * confirmed by the worker only. A whole job both phones confirmed is in two-users.spec.ts.
 */

const { en, hi, kn } = Lang.enum;
const PHONE = { width: 390, height: 844 };
const TALL_PHONE = { width: PHONE.width, height: 1400 };
const FOLDER = "records";
/** How long the worker's lone job may take to reach his record, and how long each look at it waits. */
const ONE_SIDED_MS = 120_000;
const RETRY_STEP_MS = 5_000;
/** Three jobs for two households, one of whom came back; rated 5, 4 and 5. */
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

const notice = (page: Page, lang: Lang) => page.getByRole("region", { name: t(lang, "records.notice_title") });
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

test("a new worker reads the notice in Hindi and agrees; a household says Not now and is asked again", async ({
  browser,
}) => {
  const worker = await phone(browser);
  await signIn(worker, {
    role: Role.worker,
    name: `Sunita ${RUN}`,
    phone: newPhone(),
    lang: hi,
    records: NoticeAnswer.leave,
  });
  const said = notice(worker, hi);
  for (const key of [
    "records.notice_kept",
    "records.notice_why",
    "records.notice_never",
    "records.notice_delete",
  ] as const)
    await expect(said).toContainText(t(hi, key));
  await shot(worker, "notice-worker-hi");
  await button(worker, hi, "records.agree").click();
  await expect(said).toHaveCount(0);
  await open(worker, "nav.privacy", hi);
  await expect(privacy(worker, hi)).toContainText(t(hi, "records.privacy_kept"));

  const household = await phone(browser);
  const who = { role: Role.consumer, name: `Kamala ${RUN}`, phone: newPhone(), address: "Jayanagar", lang: kn };
  await signIn(household, { ...who, records: NoticeAnswer.leave });
  await expect(notice(household, kn)).toContainText(t(kn, "records.notice_never"));
  await shot(household, "notice-household-kn");
  await button(household, kn, "records.not_now").click();
  await expect(notice(household, kn)).toHaveCount(0);
  await open(household, "nav.privacy", kn);
  await expect(privacy(household, kn)).toContainText(t(kn, "records.privacy_off"));
  // Opening the app again asks again; agreeing from it is kept.
  await household.reload();
  await button(household, kn, "records.agree").click();
  await expect(notice(household, kn)).toHaveCount(0);
  await open(household, "nav.privacy", kn);
  await expect(privacy(household, kn)).toContainText(t(kn, "records.privacy_kept"));
});

test("My work record is pulled from GigSync and downloads as a file", async ({ browser }) => {
  const page = await phone(browser);
  await seededCook(page, `Revathi ${RUN}`);
  // No share sheet here, so Download is an ordinary download.
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await open(page, "nav.receipts");
  const kept = page.getByRole("region", { name: t(en, "records.export_title") });
  await kept.getByRole("button", { name: t(en, "records.export_open") }).click();
  await expect(kept.getByRole("listitem")).toHaveCount(RATED.length);
  for (const job of await kept.getByRole("listitem").all())
    await expect(job).toContainText(t(en, "records.attested_both"));
  await expect(kept.getByText(t(en, "records.export_jobs")).locator("xpath=..")).toContainText(String(RATED.length));
  await shot(page, "work-record");
  const saving = page.waitForEvent("download");
  await kept.getByRole("button", { name: t(en, "records.download") }).click();
  const file = await saving;
  expect(file.suggestedFilename()).toMatch(/^gigsync-work-record-\d{4}-\d{2}-\d{2}\.csv$/);
  const lines = readFileSync(await file.path(), "utf8")
    .trim()
    .split("\r\n");
  expect(lines[0]).toBe("Date,Work,Price (₹),Received (₹),Paid by,Status,Confirmed by,Stars");
  expect(lines.slice(1).map((l) => l.split(",").slice(1, 3).concat(l.split(",").slice(5)))).toEqual([
    ["Cook", "11000.00", "Done", "Both", "5"],
    ["Cook", "11000.00", "Done", "Both", "4"],
    ["Cook", "11000.00", "Done", "Both", "5"],
  ]);
  await expect(kept).toContainText(t(en, "records.downloaded", { file: file.suggestedFilename() }));
});

test("Delete my records from GigSync says what goes, then the card's record is zero and nothing is kept", async ({
  browser,
}) => {
  const page = await phone(browser);
  await seededCook(page, `Nirmala ${RUN}`);
  await open(page, "nav.card");
  const mine = page.getByRole("region", { name: t(en, "page.card_seen") });
  await expect(mine.getByRole("definition")).toHaveText(["3", t(en, "record.card_stars", { stars: "4.7" }), "1"]);

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
  await expect(mine.getByRole("definition")).toHaveText(["0", t(en, "record.card_no_stars"), "0"]);
  // Opening the app again does not ask: the owner chose to stop, and Privacy offers it again.
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(notice(page, en)).toHaveCount(0);
});

test("a household says Not now; the worker's job still counts, marked as confirmed by the worker only", async ({
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
  await signIn(householdPage, { ...who, records: NoticeAnswer.later });
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

  // Only his phone sent the job; GigSync keeps it as his once her signature reached him, and it counts on his card.
  const kept = workerPage.getByRole("region", { name: t(en, "records.export_title") });
  await expect(async () => {
    // Opened afresh each time: a pull that found nothing yet shows that until the screen opens again.
    await open(workerPage, "nav.activity");
    await open(workerPage, "nav.receipts");
    await kept.getByRole("button", { name: t(en, "records.export_open") }).click({ timeout: RETRY_STEP_MS });
    await expect(kept.getByRole("listitem")).toHaveCount(1, { timeout: RETRY_STEP_MS });
  }).toPass({ timeout: ONE_SIDED_MS });
  await expect(kept.getByRole("listitem")).toContainText(t(en, "records.attested_you"));
  await shot(workerPage, "one-sided");
  await open(workerPage, "nav.card");
  const mine = workerPage.getByRole("region", { name: t(en, "page.card_seen") });
  await expect(mine.getByRole("definition").first()).toHaveText("1");
});
