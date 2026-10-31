import { driverSpread, jobRange, type MessageKey, plural, priceText, RATE_CARDS, t } from "@gigsync/core";
import { DEFAULT_SCOPE, driversFromScope, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, reveal, shoot, signIn, textOf } from "./helpers.js";
import { type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * Rate estimates through the real screens and the real API (ADR 0041): with no painting jobs on GigSync, a 2BHK
 * painted, labour only, in Bengaluru gets its range from the city's rate card, the same whether the phone sends the
 * scope buckets (the worker's card) or the drivers (the household's chat: 2 bedrooms, the household buys the paint,
 * the rest assumed after "I don't know"). A painter making a card sees the range, what it rests on and a suggested
 * amount; a household asking to paint a 2BHK sees it beside the budget; after both sign, nobody is asked to share the
 * price (ADR 0039 ended that); an offer far below the range is flagged.
 */

const { en } = Lang.enum;
const FOLDER = "estimate";
const PAINTER = t(en, "trade.painter");
/** The rate card's 2BHK band, labour only, rounded to ₹10 as the API rounds; the card's default scope is the same job. */
const STEP = 1000;
const BAND = jobRange(
  RATE_CARDS.bengaluru?.entries.painter.range ?? { low: 0, typical: 0, high: 0 },
  driverSpread("painter", driversFromScope("painter", DEFAULT_SCOPE.painter)),
);
const price = (paise: number) => priceText(Math.round(paise / STEP) * STEP);
const RANGE = {
  trade: PAINTER,
  city: t(en, "city.bengaluru"),
  scope: t(en, "estimate.scope", { scope: `${t(en, "estimate.rooms.bhk2")}, ${t(en, "estimate.labour.yes")}` }),
  low: price(BAND.low),
  high: price(BAND.high),
};
/** The usual figure: the household's suggested budget and the worker's suggested opening. */
const TYPICAL = price(BAND.typical);
/** What the range rests on: the Bengaluru rate card, whose painting figures are a GigSync seed. */
const CARD_BASIS = {
  parts: t(en, "driver.basis.rate_card", { city: t(en, "city.bengaluru"), sources: "GigSync seed, unverified" }),
};
/** ADR 0030's sharing card and setting, as they were labelled; their strings are gone from the catalog. */
const OLD_SHARE = /share (this|agreed) prices?/i;

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
  // What moves the price (ADR 0041): the household buys the paint, and "I don't know" to the next ends the questions.
  await tap(page, t(en, "driver.value.paint_by.household"));
  await tap(page, t(en, "driver.dont_know"));
  await tap(page, t(en, "when.tomorrow"));
  await expect(line(page, "need.ask.budget")).toBeVisible();
  await expect(line(page, "estimate.range_job", RANGE)).toBeVisible();
  await expect(line(page, "driver.confidence_line", { level: t(en, "driver.confidence.low") })).toBeVisible();
  await expect(line(page, "estimate.suggest_budget", { price: TYPICAL })).toBeVisible();
  await shoot("budget-estimate", { household: page }, FOLDER);
  if (budget === "suggested") await tap(page, t(en, "estimate.use", { price: TYPICAL }));
  else await say(page, budget);
  await tap(page, t(en, "flag.yes"));
}

/**
 * Ticks only `name` among the workers found and asks them. The painter's agent has nothing to ask: who buys the paint
 * was answered in Find as a price question (ADR 0041) and travels in the request's details.
 */
async function askAndAnswer(page: Page, name: string) {
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name }) }).check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  await open(page, "nav.my_jobs");
  await expect(page.getByRole("form", { name: t(en, "a11y.answer") })).toHaveCount(0);
}

async function painterCard(phone: Phone, name: string) {
  await signIn(phone.page, { role: Role.worker, name, phone: newPhone(), lang: en });
  await publishCard(phone, { trade: PAINTER, area: "hsr_layout", rate: "20000", min: "12000", about: "Walls" });
}

test("a painter making a card in Talk sees the usual range, what it rests on and a suggested amount", async ({
  browser,
}) => {
  const [page] = (await phones(browser, 1)) as [Page];
  await signIn(page, { role: Role.worker, name: `Kiran ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await tap(page, PAINTER);
  await tap(page, t(en, "area.koramangala"));

  await expect(line(page, "estimate.range_job", RANGE)).toBeVisible();
  await expect(line(page, "driver.basis_line", CARD_BASIS)).toBeVisible();
  await expect(line(page, "estimate.suggest_rate", { price: TYPICAL })).toBeVisible();
  await shoot("card-estimate", { worker: page }, FOLDER);

  // The suggestion is the worker's to take or change: a tap uses it, and the least they take is suggested next.
  await tap(page, t(en, "estimate.use", { price: TYPICAL }));
  await expect(line(page, "iv.got_rate", { price: TYPICAL })).toBeVisible();
  await expect(line(page, "estimate.suggest_min", { price: RANGE.low })).toBeVisible();
});

test("a household sees the range beside its budget; after both sign nobody is asked to share the price", async ({
  browser,
}) => {
  const [workerPage, homePage] = (await phones(browser, 2)) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const home: Phone = { page: homePage, lang: en };
  const name = `Kiran ${RUN}`;
  await painterCard(worker, name);
  // My card shows the same estimate under the trades, with the amounts it suggests.
  await expect(line(workerPage, "estimate.range_job", RANGE)).toBeVisible();
  await expect(workerPage.getByRole("button", { name: t(en, "estimate.use", { price: RANGE.low }) })).toBeVisible();

  await signIn(homePage, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await askToPaint(homePage, "suggested");
  await askAndAnswer(homePage, name);
  await open(workerPage, "nav.activity");
  await signBoth({ worker, customer: home }, FOLDER);

  // No card on the signed job asks to share its price, on either phone, and Privacy has no such setting.
  let shared = false;
  await homePage.route("**/v1/estimates/prices", async (route) => {
    shared = true;
    await route.fulfill({ status: 404 });
  });
  await open(homePage, "nav.my_jobs");
  await expect(homePage.getByText(t(en, "job.both_signed")).first()).toBeVisible();
  await expect(homePage.getByText(OLD_SHARE)).toHaveCount(0);
  await open(workerPage, "nav.activity");
  await expect(workerPage.getByText(OLD_SHARE)).toHaveCount(0);
  await open(homePage, "nav.privacy");
  await expect(homePage.getByText(OLD_SHARE)).toHaveCount(0);
  expect(shared).toBe(false);
});

test("an offer far below the range carries a note to the worker, and nothing is blocked", async ({ browser }) => {
  const [workerPage, homePage] = (await phones(browser, 2)) as [Page, Page];
  const name = `Ravi ${RUN}`;
  await painterCard({ page: workerPage, lang: en }, name);
  await signIn(homePage, { role: Role.consumer, name: `Uma ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await askToPaint(homePage, "8000");
  await askAndAnswer(homePage, name);

  await open(workerPage, "nav.activity");
  const note = workerPage
    .getByRole("note")
    .filter({ hasText: textOf(en, "estimate.below", { low: RANGE.low, high: RANGE.high }) });
  await reveal(workerPage, note.first());
  await shoot("far-below", { worker: workerPage }, FOLDER);
});
