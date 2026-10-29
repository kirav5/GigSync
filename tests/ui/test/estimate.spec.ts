import { type MessageKey, plural, questionText, t } from "@gigsync/core";
import { Lang, SharedPrice } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, reveal, shoot, signIn, textOf } from "./helpers.js";
import { type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * Rate estimates through the real screens and the real API (ADR 0030), with the API's fixture quote source
 * (ESTIMATE_SOURCE=fixture in workers/api/.dev.vars): no web search and no model in the test. For a 2BHK painted,
 * labour only, in Bengaluru it answers ₹14,000 / ₹16,000 / ₹18,000 from three pages. A painter making a card sees the
 * range with its sources and a suggested amount; a household asking to paint a 2BHK sees it beside the budget; after
 * both sign, each is asked once whether to share the price anonymously; an offer far below the range is flagged.
 */

const { en } = Lang.enum;
const FOLDER = "estimate";
const PAINTER = t(en, "trade.painter");
const RANGE = {
  trade: PAINTER,
  city: t(en, "city.bengaluru"),
  scope: t(en, "estimate.scope", { scope: `${t(en, "estimate.rooms.bhk2")}, ${t(en, "estimate.labour.yes")}` }),
  low: "₹14,000",
  high: "₹18,000",
};
/** The fixture's five quotes come from three pages; the app counts pages. */
const SOURCES = 3;
/** All a shared price carries: no user, name, contact or exact day. */
const SHARED_KEYS = ["area_key", "city", "month", "price_paise", "scope", "trade"];

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phones(browser: { newContext: () => Promise<BrowserContext> }, count: number): Promise<Page[]> {
  contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext()));
  return Promise.all(contexts.map((c) => c.newPage()));
}

/** Taps a choice under the newest question in Talk or Find's chat. */
const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).last().click();

/** Types into Find's chat. */
async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

const line = (page: Page, key: MessageKey, params = {}) => page.getByText(textOf(en, key, params)).last();

/** The household asks, in Find's chat, to paint their 2BHK in HSR Layout tomorrow, and picks a budget. */
async function askToPaint(page: Page, budget: "suggested" | string) {
  await open(page, "nav.find");
  await expect(page.getByRole("log")).toContainText(t(en, "need.start"));
  await say(page, "paint my 2BHK");
  await tap(page, t(en, "area.hsr_layout"));
  await tap(page, t(en, "when.tomorrow"));
  await expect(line(page, "need.ask.budget")).toBeVisible();
  await expect(line(page, "estimate.range_job", RANGE)).toBeVisible();
  await expect(line(page, "estimate.basis.other", { count: SOURCES })).toBeVisible();
  await expect(line(page, "estimate.suggest_budget", { price: "₹16,000" })).toBeVisible();
  await shoot("budget-estimate", { household: page }, FOLDER);
  if (budget === "suggested") await tap(page, t(en, "estimate.use", { price: "₹16,000" }));
  else await say(page, budget);
  await tap(page, t(en, "flag.yes"));
}

/** Ticks only `name` among the workers found and asks them; then answers the painter's agent: labour only. */
async function askAndAnswer(page: Page, name: string) {
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name }) }).check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  await open(page, "nav.my_jobs");
  const answer = page.getByRole("form", { name: t(en, "a11y.answer") });
  await answer.getByLabel(questionText(en, "labour_only")).selectOption("yes");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();
}

async function painterCard(phone: Phone, name: string) {
  await signIn(phone.page, { role: Role.worker, name, phone: newPhone(), lang: en });
  await publishCard(phone, { trade: PAINTER, area: "hsr_layout", rate: "20000", min: "12000", about: "Walls" });
}

test("a painter making a card in Talk sees the usual range with sources and a suggested amount", async ({
  browser,
}) => {
  const [page] = (await phones(browser, 1)) as [Page];
  await signIn(page, { role: Role.worker, name: `Kiran ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await tap(page, PAINTER);
  await tap(page, t(en, "area.koramangala"));

  await expect(line(page, "estimate.range_job", RANGE)).toBeVisible();
  await expect(line(page, "estimate.basis.other", { count: SOURCES })).toBeVisible();
  await expect(line(page, "estimate.suggest_rate", { price: "₹16,000" })).toBeVisible();
  const sources = page
    .getByRole("log")
    .locator("summary")
    .filter({ hasText: t(en, "estimate.sources") })
    .last();
  await sources.click();
  await expect(page.getByRole("log").getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  await shoot("card-estimate", { worker: page }, FOLDER);

  // The suggestion is the worker's to take or change: a tap uses it, and the least they take is suggested next.
  await tap(page, t(en, "estimate.use", { price: "₹16,000" }));
  await expect(line(page, "iv.got_rate", { price: "₹16,000" })).toBeVisible();
  await expect(line(page, "estimate.suggest_min", { price: "₹14,000" })).toBeVisible();
});

test("a household sees the range beside its budget; after both sign each is asked once to share the price", async ({
  browser,
}) => {
  const [workerPage, homePage] = (await phones(browser, 2)) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const home: Phone = { page: homePage, lang: en };
  const name = `Kiran ${RUN}`;
  await painterCard(worker, name);
  // My card shows the same estimate under the trades, with the amounts it suggests.
  await expect(line(workerPage, "estimate.range_job", RANGE)).toBeVisible();
  await expect(workerPage.getByRole("button", { name: t(en, "estimate.use", { price: "₹14,000" }) })).toBeVisible();

  await signIn(homePage, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await askToPaint(homePage, "suggested");
  await askAndAnswer(homePage, name);
  await open(workerPage, "nav.today");
  await signBoth({ worker, customer: home }, FOLDER);

  // Ask each time is the default; the card is on the signed job, and Yes sends the price.
  await open(homePage, "nav.profile");
  const setting = homePage.getByRole("region", { name: t(en, "estimate.setting_label") });
  await expect(setting.getByRole("button", { name: t(en, "estimate.setting_ask") })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await open(homePage, "nav.my_jobs");
  const card = homePage.getByRole("group", { name: t(en, "estimate.share_ask") });
  await reveal(homePage, card);
  await expect(card).toContainText(t(en, "estimate.share_what"));
  await shoot("share-card", { household: homePage }, FOLDER);
  // Answered here, never stored: this suite runs against the shared database, and a test price kept there would be
  // blended into real estimates. Storing a shared price is covered by the API tests on a local database.
  let shared: Record<string, unknown> | undefined;
  await homePage.route("**/v1/estimates/prices", async (route) => {
    shared = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 204 });
  });
  await card.getByRole("button", { name: t(en, "estimate.share_yes") }).click();
  await expect.poll(() => shared && Object.keys(shared).sort()).toEqual(SHARED_KEYS);
  expect(SharedPrice.safeParse(shared).success).toBe(true);
  await expect(homePage.getByText(t(en, "estimate.shared"))).toBeVisible();
  await expect(card).toHaveCount(0);

  // The worker is asked too, on their own phone, and No sends nothing.
  await open(workerPage, "nav.today");
  const theirs = workerPage.getByRole("group", { name: t(en, "estimate.share_ask") });
  await reveal(workerPage, theirs);
  await theirs.getByRole("button", { name: t(en, "estimate.share_no") }).click();
  await expect(theirs).toHaveCount(0);
});

test("an offer far below the range carries a note to the worker, and nothing is blocked", async ({ browser }) => {
  const [workerPage, homePage] = (await phones(browser, 2)) as [Page, Page];
  const name = `Ravi ${RUN}`;
  await painterCard({ page: workerPage, lang: en }, name);
  await signIn(homePage, { role: Role.consumer, name: `Uma ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await askToPaint(homePage, "8000");
  await askAndAnswer(homePage, name);

  await open(workerPage, "nav.today");
  const note = workerPage
    .getByRole("note")
    .filter({ hasText: textOf(en, "estimate.below", { low: "₹14,000", high: "₹18,000" }) });
  await reveal(workerPage, note.first());
  await shoot("far-below", { worker: workerPage }, FOLDER);
});
