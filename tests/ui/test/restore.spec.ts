import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, test } from "@playwright/test";
import { MovePrompt, newPhone, onScreen, open, Role, RUN, signIn } from "./helpers.js";
import { seedServedJobs } from "./record-seed.js";

/**
 * A new phone refills its job list from the owner's record on GigSync (ADR 0038 §4): a worker whose jobs GigSync keeps
 * signs in on a fresh phone and finds them in Records (counted under Activity's Closed), marked as restored, with no messages or contacts.
 */

const { en } = Lang.enum;
const JOBS = [
  { household: 1, stars: 5 },
  { household: 2, stars: 4 },
];

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

test("a fresh phone sees the owner's jobs restored from their record", async ({ browser }) => {
  const number = newPhone();
  await seedServedJobs(number, JOBS);
  contexts = [await browser.newContext()];
  const page = await (contexts[0] as BrowserContext).newPage();
  // Seeding signed the number in elsewhere, so the move prompt comes; this owner is not moving.
  await signIn(page, { role: Role.worker, name: `Shanti ${RUN}`, phone: number, elsewhere: MovePrompt.notNow });

  // Finished jobs live in Records only: Activity counts them under Closed, which opens Records.
  await open(page, "nav.activity");
  const closed = page.getByRole("button", { name: t(en, "activity.tab_closed"), exact: true });
  await expect(closed).toContainText(String(JOBS.length));
  await expect(page.getByRole("article")).toHaveCount(0);
  await closed.click();
  await onScreen(page, "nav.records");

  // Records: both jobs are in the worker's record on this phone, waiting to be asked for.
  const record = page.getByRole("region", { name: t(en, "record.title") });
  await expect(record).toContainText(t(en, "record.state_not_asked"));
  // Only the months' own rows: an open row's job card has lists of its own.
  const rows = record.locator(".record-list > li").filter({ hasText: t(en, "trade.cook") });
  await expect(rows).toHaveCount(JOBS.length);
  // Each row opens to the job's card, marked as restored, with no contact and nothing left to do.
  for (const row of await rows.all()) {
    await row.getByRole("button", { name: t(en, "record.open") }).click();
    const job = row.getByRole("article");
    await expect(job).toContainText(t(en, "contacts.restored"));
    await expect(job).toContainText(t(en, "contacts.restored_price", { price: "₹11,000" }));
    await expect(job.getByLabel(t(en, "a11y.contact"))).toHaveCount(0);
    await expect(job.getByRole("button", { name: t(en, "job.mark_done") })).toHaveCount(0);
    await expect(job.getByLabel(t(en, "a11y.review"))).toContainText("★★★★");
    await row.getByRole("button", { name: t(en, "record.close") }).click();
  }
});
