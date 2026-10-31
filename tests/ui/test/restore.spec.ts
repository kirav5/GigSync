import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, test } from "@playwright/test";
import { MovePrompt, newPhone, open, Role, RUN, reveal, signIn } from "./helpers.js";
import { seedServedJobs } from "./record-seed.js";

/**
 * A new phone refills its job list from the owner's record on GigSync (ADR 0038 §4): a worker whose jobs GigSync keeps
 * signs in on a fresh phone and finds them in Activity and Receipts, marked as restored, with no messages or contacts.
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

  await open(page, "nav.activity");
  const restored = page.getByRole("article").filter({ hasText: t(en, "contacts.restored") });
  await reveal(page, restored.first());
  await expect(restored).toHaveCount(JOBS.length);
  for (const job of await restored.all()) {
    await expect(job).toContainText(t(en, "trade.cook"));
    await expect(job).toContainText(t(en, "contacts.restored_price", { price: "₹11,000" }));
    await expect(job.getByLabel(t(en, "a11y.contact"))).toHaveCount(0);
    await expect(job.getByRole("button", { name: t(en, "job.mark_done") })).toHaveCount(0);
  }
  await expect(restored.getByLabel(t(en, "a11y.review")).first()).toContainText("★★★★");

  // Receipts: both jobs are in the worker's record on this phone, waiting to be asked for.
  await open(page, "nav.receipts");
  const record = page.getByRole("region", { name: t(en, "record.title") });
  await expect(record).toContainText(t(en, "record.state_not_asked"));
  // Only the months' own rows: an open row's job card has lists of its own.
  const rows = record.locator(".record-list > li");
  await expect(rows.filter({ hasText: t(en, "trade.cook") })).toHaveCount(JOBS.length);
});
