import { hourText, plural, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { skipPriceQuestions } from "./findChat.js";
import { expand, newPhone, open, openCard, Role, RUN, reveal, shoot, signIn, textOf } from "./helpers.js";
import { cleanUpLater, type Phone, signBoth, unlistCards } from "./journey.js";

/**
 * Terms besides the price through the real screens and API (ADR 0033 §3–5), with no model on either phone: the word
 * lists read the household's long description into chips it confirms, the agents settle the hour she booked and
 * who buys the paint (the painter brings his own), the household signs the changed term itself, both see the terms
 * they signed, and every offer in the agents' talk says why it is what it is. A painter whose hours leave out the
 * morning is not listed at all since ADR 0050 §3, so the term the agents change is the paint, not the time.
 */

const { en } = Lang.enum;
const FOLDER = "terms";
const PAINTER = t(en, "trade.painter");
const DESCRIPTION =
  "We just moved in and the walls are patchy. Please paint 2 rooms with 2 coats, " +
  "I will buy the paint myself. Tomorrow morning in HSR Layout.";
/** The hour she books out of "tomorrow morning" (ADR 0053 §1), which the terms then carry. */
const NINE = hourText(en, 9);
const PAINTER_BUYS = t(en, "terms.materials.worker");
const SHE_BUYS = t(en, "terms.materials.household");

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).last().click();

async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

/** The painter's card, saying on My card that they bring the materials themselves; any day, any time. */
async function paintBringingPainter(phone: Phone, name: string) {
  const { page } = phone;
  await signIn(page, { role: Role.worker, name, phone: newPhone(), lang: en });
  await openCard(page, en);
  const form = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await form.getByRole("button", { name: PAINTER, exact: true }).click();
  await form.getByLabel(t(en, "card.where")).selectOption({ label: t(en, "area.hsr_layout") });
  await form.getByLabel(t(en, "card.rate")).fill("20000");
  await form.getByLabel(t(en, "card.min")).fill("12000");
  await form.getByLabel(t(en, "card.about")).fill("Walls and ceilings");
  const prefs = form.getByRole("group", { name: t(en, "terms.card") });
  const mine = prefs.getByRole("button", { name: t(en, "terms.card_mine"), exact: true });
  await mine.click();
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await shoot("painter-terms", { worker: page }, FOLDER);
  await page.getByRole("button", { name: t(en, "card.publish"), exact: true }).click();
  cleanUpLater(phone);
  await expect(page.getByRole("status").filter({ hasText: textOf(en, "card.on_board") })).toBeVisible();
}

test("a long description becomes confirmed chips, the agents settle the terms, and both sign them", async ({
  browser,
}) => {
  contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [workerPage, homePage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const home: Phone = { page: homePage, lang: en };
  const name = `Kiran ${RUN}`;
  await paintBringingPainter(worker, name);

  await signIn(homePage, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await open(homePage, "nav.find");
  const log = homePage.getByRole("log");
  await expect(log).toContainText(t(en, "need.start"));
  await say(homePage, DESCRIPTION);

  // The scope read from her words waits as chips; nothing about the estimate until she confirms them.
  await expect(log).toContainText(t(en, "terms.scope_read"));
  for (const chip of [plural(en, "terms.chip.rooms", 2), t(en, "terms.chip.labour_yes"), plural(en, "terms.coats", 2)])
    await expect(log.getByRole("button", { name: chip, exact: true }).last()).toBeVisible();
  await expect(log).not.toContainText(t(en, "need.ask.budget"));
  await shoot("scope-chips", { household: homePage }, FOLDER);
  await tap(homePage, t(en, "terms.scope_ok"));

  // Rooms, area and day were all in the words: after a price question (ADR 0041) and the hour, which "morning" is not
  // (ADR 0053 §1), the budget is next, beside the estimate for her scope.
  await skipPriceQuestions(home);
  await tap(homePage, NINE);
  await expect(log).toContainText(t(en, "need.ask.budget"));
  // The suggested budget is the rate card's usual figure for the job (ADR 0041); she takes it, whatever it is.
  await log
    .getByRole("button", { name: textOf(en, "estimate.use") })
    .last()
    .click();
  await tap(homePage, t(en, "flag.yes"));
  const found = homePage.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name }) }).check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();

  // Kiran brings the paint: his agent holds to it and hers takes it as a change for her to sign. Whichever agent
  // accepted first, its owner signs first; Lata's sign card then shows the paint changed from what she asked for.
  await open(homePage, "nav.my_jobs");
  await open(workerPage, "nav.activity");
  const sign = homePage.getByRole("group", { name: t(en, "a11y.sign") });
  const theirs = workerPage.getByRole("group", { name: t(en, "a11y.sign") });
  await expect(async () => {
    const seen = await Promise.all([sign.isVisible(), theirs.isVisible()]);
    expect(seen.some(Boolean)).toBe(true);
  }).toPass();
  const workerFirst = !(await sign.isVisible());
  if (workerFirst) {
    await expect(theirs.getByRole("list", { name: t(en, "terms.title") })).toContainText(PAINTER_BUYS);
    await theirs.getByRole("button", { name: textOf(en, "job.sign") }).click();
  }
  await reveal(homePage, sign);
  const terms = sign.getByRole("list", { name: t(en, "terms.title") });
  await expect(terms).toContainText(NINE);
  await expect(terms).toContainText(PAINTER_BUYS);
  await expect(terms).toContainText(plural(en, "terms.coats", 2));
  await expect(terms.locator("[data-changed]")).toContainText(SHE_BUYS);
  await expect(sign.getByRole("note")).toContainText(t(en, "terms.check"));

  // Every offer in the agents' talk says why it is what it is, from facts the phone built.
  await expand(homePage, "talk.title");
  const why = homePage.getByRole("note", { name: t(en, "explain.label") });
  await expect(why.first()).toContainText(textOf(en, "explain.opened_theirs", { name }));
  // An offer inside her budget says by how much it is under it (or that it is exactly it), never "past" it.
  const inside = new RegExp(
    `${textOf(en, "explain.limit.requester.below").source}|${textOf(en, "explain.limit.requester.at").source}`,
  );
  await expect(why.filter({ hasText: inside }).first()).toBeVisible();
  await expect(homePage.getByText(textOf(en, "terms.proposed")).first()).toBeVisible();
  await shoot("sign-terms", { household: homePage, worker: workerPage }, FOLDER);

  if (workerFirst) await sign.getByRole("button", { name: textOf(en, "job.sign") }).click();
  else await signBoth({ worker, customer: home }, FOLDER);
  for (const phone of [workerPage, homePage]) {
    const deal = phone.getByLabel(t(en, "a11y.deal"));
    await reveal(phone, deal);
    await expect(deal.getByRole("list", { name: t(en, "terms.title") })).toContainText(PAINTER_BUYS);
  }
  await shoot("signed-terms", { household: homePage, worker: workerPage }, FOLDER);
});
