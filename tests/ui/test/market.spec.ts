import { priceText, t } from "@gigsync/core";
import { type Estimate, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";
import { unlistCards } from "./journey.js";
import { COOK_REQUEST, estimateNow, seedAreaJobs } from "./market-seed.js";

/**
 * Market prices from GigSync's own agreed jobs (ADR 0039): with at least ten cooking jobs agreed in Jayanagar, the
 * worker's rate question, the household's budget and a market question asked in either chat all answer with the range
 * those jobs give, saying it comes from jobs on GigSync in Jayanagar. Nobody is asked to share a price any more.
 */

const { en } = Lang.enum;
const FOLDER = "market";
const AREA = "jayanagar";
const K_MIN = 10;
const PRICE_PAISE = 1_200_000;
const QUESTION = "what do cooks charge in Jayanagar?";
/** ADR 0030's sharing setting, as Privacy used to label it; its strings are gone from the catalog. */
const OLD_SHARE_SETTING = /share agreed prices/i;

const PLACE = t(en, "area.jayanagar");
const SCOPE = t(en, "estimate.scope", { scope: `${t(en, "estimate.people.3_4")}, ${t(en, "estimate.meals.2")}` });

let contexts: BrowserContext[] = [];
let range: Estimate | undefined;
/** The household's range: its request carries the drivers it said (ADR 0041), 4 people and 2 meals. */
let homeRange: Estimate | undefined;

test.beforeAll(async () => {
  await seedAreaJobs(AREA, K_MIN, PRICE_PAISE);
  range = await estimateNow({ ...COOK_REQUEST, area: AREA });
  homeRange = await estimateNow({ ...COOK_REQUEST, area: AREA, drivers: { meals: 2, people: 4 } });
});

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: () => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  return context.newPage();
}

/** At most this many questions before the budget. */
const TURNS_MAX = 5;

const log = (page: Page) => page.getByRole("log");

/** The first of these that is on screen now, if any. */
async function firstVisible(locators: readonly Locator[]): Promise<Locator | undefined> {
  for (const l of locators) if (await l.isVisible()) return l;
  return undefined;
}
const tap = (page: Page, label: string) => log(page).getByRole("button", { name: label, exact: true }).last().click();

/** How the app joins the parts of a blend, and a rate card's sources. */
const JOIN = " + ";

/** The range line for a cook in Jayanagar and the line saying it rests on jobs on GigSync, then the city's rate card. */
function rangeLines(e: Estimate) {
  const prices = { low: priceText(e.low_paise), high: priceText(e.high_paise) };
  const sources = (e.basis.rate_card?.sources ?? []).map((s) => s.name).join(JOIN);
  const parts = [
    t(en, "driver.basis.gigsync.other", { count: e.basis.gigsync_jobs }),
    t(en, "driver.basis.rate_card", { city: t(en, "city.bengaluru"), sources }),
  ].join(JOIN);
  return {
    range: textOf(en, "estimate.range_month", { trade: t(en, "trade.cook"), city: PLACE, scope: SCOPE, ...prices }),
    basis: textOf(en, "driver.basis_line", { parts }),
  };
}

test("the API answers a cook in Jayanagar from the jobs agreed there", () => {
  expect(range?.basis).toMatchObject({ kind: "gigsync", area: AREA, blend: ["gigsync", "rate_card"] });
  expect(range?.basis.gigsync_jobs).toBeGreaterThanOrEqual(K_MIN);
});

test("a worker's rate question shows the range from jobs on GigSync, and Talk answers a market question", async ({
  browser,
}) => {
  const e = range as Estimate;
  const page = await phone(browser);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await tap(page, t(en, "trade.cook"));
  await tap(page, PLACE);
  const lines = rangeLines(e);
  await expect(log(page).getByText(lines.range).last()).toBeVisible();
  await expect(log(page).getByText(lines.basis).last()).toBeVisible();
  await shoot("rate-question", { worker: page }, FOLDER);

  // Later, then a question in her own words: the answer is the same range, with what it rests on and where.
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();
  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  await box.getByPlaceholder(t(en, "agent.placeholder")).fill(QUESTION);
  await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
  await expect(log(page).getByText(QUESTION)).toBeVisible();
  await expect(log(page)).toContainText(new RegExp(`${lines.range.source}.*${lines.basis.source}`));
  await shoot("talk-question", { worker: page }, FOLDER);
});

test("a household's market question and budget both show the range from jobs on GigSync in Jayanagar", async ({
  browser,
}) => {
  const e = range as Estimate;
  const lines = rangeLines(e);
  const page = await phone(browser);
  await signIn(page, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "Jayanagar", lang: en });
  await open(page, "nav.find");
  await expect(log(page)).toContainText(t(en, "need.start"));
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  const say = async (words: string) => {
    await box.getByRole("textbox").fill(words);
    await box.getByRole("button", { name: t(en, "a11y.send") }).click();
  };

  // A question first: answered in the chat, and the need has not started.
  await say(QUESTION);
  await expect(log(page)).toContainText(new RegExp(`${lines.range.source}.*${lines.basis.source}`));
  await expect(log(page).getByText(textOf(en, "need.ask.budget"))).toHaveCount(0);
  await shoot("find-question", { household: page }, FOLDER);

  // Then the need: beside the budget question, the same range and what it rests on.
  await say("I need a cook in Jayanagar for 4 people, 2 meals a day");
  const budget = log(page).getByText(textOf(en, "need.ask.budget"));
  // Whatever the chat still asks before the budget: the scope it read (right), how often (every day), a detail (skip).
  const chips = (["terms.scope_ok", "when.daily", "iv.skip"] as const).map((key) =>
    log(page)
      .getByRole("button", { name: t(en, key), exact: true })
      .last(),
  );
  for (let turn = 0; turn < TURNS_MAX && !(await budget.isVisible()); turn++) {
    await expect(chips.reduce((any, chip) => any.or(chip), budget).first()).toBeVisible();
    const next = await firstVisible(chips);
    if (!next) break;
    // Each agent turn has one replay button: one more says the chat asked its next question.
    const turns = log(page).getByRole("button", { name: t(en, "speech.replay"), exact: true });
    const before = await turns.count();
    await next.click();
    await expect(turns).not.toHaveCount(before);
  }
  await expect(budget).toBeVisible();
  // ADR 0041: GigSync's per-unit rate for 4 people and 2 meals, saying what it rests on and how sure it is.
  const home = homeRange as Estimate;
  expect(home.basis.blend?.[0]).toBe("gigsync");
  const homePrices = { low: priceText(home.low_paise), high: priceText(home.high_paise) };
  const homeLine = textOf(en, "estimate.range_month", { trade: t(en, "trade.cook"), scope: SCOPE, ...homePrices });
  await expect(log(page).getByText(homeLine).last()).toBeVisible();
  // What it rests on: the jobs on GigSync, then the city's rate card with its sources.
  const jobs = t(en, "driver.basis.gigsync.other", { count: home.basis.gigsync_jobs });
  const basis = log(page).getByText(textOf(en, "driver.basis_line")).last();
  await expect(basis).toContainText(jobs);
  await expect(basis).toContainText(t(en, "driver.basis.rate_card", { city: t(en, "city.bengaluru"), sources: "" }));
  await expect(log(page).getByText(textOf(en, "driver.confidence_line")).last()).toBeVisible();
  await expect(log(page).getByText(textOf(en, "estimate.suggest_budget")).last()).toBeVisible();
  await shoot("budget", { household: page }, FOLDER);

  // Privacy no longer asks to share agreed prices.
  await open(page, "nav.privacy");
  await expect(page.getByRole("region", { name: t(en, "records.privacy_title") }).first()).toBeVisible();
  await expect(page.getByText(OLD_SHARE_SETTING)).toHaveCount(0);
});
