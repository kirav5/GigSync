import { type ApiClient, plural, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { listWorker, newPhone, onScreen, open, Role, RUN, reveal, shoot, signIn, textOf } from "./helpers.js";

/**
 * A household finds a worker by talking, the way a worker makes their card in Talk: one sentence in their own words,
 * then only what is missing, a readback, the search, and the ask. The worker is listed through the API; nobody
 * answers for them, so the request waits in My jobs, where the household can follow it.
 */

const { en, hi } = Lang.enum;
const HSR = { lat: 12.9116, lon: 77.6474 };
const KORAMANGALA = { lat: 12.9352, lon: 77.6245 };
const RATE_PAISE = 65_000;
const FOLDER = "find-chat";

let listed: ApiClient[] = [];

test.afterAll(async () => {
  await Promise.all(listed.map((api) => api.removeProfile()));
  listed = [];
});

/** The chat's box, where the owner types (or speaks) their answers. */
async function say(page: Page, lang: Lang, words: string) {
  const box = page.getByRole("form", { name: t(lang, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(lang, "a11y.send") }).click();
}

/** Taps a choice under the newest question. */
const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).click();

/** Ticks only `name` among the workers found, then asks them. */
async function askOnly(page: Page, lang: Lang, name: string) {
  const found = page.getByRole("group", { name: t(lang, "a11y.ask_workers") });
  await expect(found.getByLabel(t(lang, "a11y.worker", { name }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(lang, "a11y.ask_worker", { name }) }).check();
  await shoot("found", { household: page }, FOLDER);
  await found.getByRole("button", { name: plural(lang, "find.ask", 1) }).click();
}

test("a household says what they need in one sentence and is asked only for the area", async ({ browser }) => {
  const worker = `Ravi ${RUN}`;
  listed.push(await listWorker(worker, ["electrician"], HSR, RATE_PAISE, { area_name: "HSR Layout", languages: [en] }));
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, {
    role: Role.consumer,
    name: `Meena ${RUN}`,
    phone: newPhone(),
    address: "Flat 4, HSR",
    lang: en,
  });

  // Find opens as the chat, like Talk.
  const log = page.getByRole("log");
  await expect(log).toContainText(t(en, "need.start"));
  await say(page, en, "Bedroom fan not working, need an electrician tomorrow morning, up to 700");

  // Only the area is missing: no question about the problem, the day or the budget.
  await expect(log).toContainText(t(en, "need.ask.area"));
  for (const asked of ["question.problem", "need.ask.when", "need.ask.budget"] as const)
    await expect(log).not.toContainText(t(en, asked));
  await say(page, en, "HSR");

  // The readback: what, where and when, the words workers read (never the budget), and the budget, kept here.
  const words = "Bedroom fan not working, need an electrician tomorrow morning";
  await expect(log).toContainText(
    t(en, "need.summary", { trade: "Electrician", area: "HSR Layout", when: "Tomorrow" }),
  );
  await expect(log).toContainText(t(en, "need.summary_words", { words }));
  await expect(log).toContainText(t(en, "need.summary_budget", { budget: "₹700" }));
  await shoot("readback", { household: page }, FOLDER);
  await tap(page, t(en, "flag.yes"));

  await askOnly(page, en, worker);
  await onScreen(page, "nav.my_jobs", en);
  await reveal(page, page.getByText(words).first());
  await expect(page.getByText(/700/)).toHaveCount(0);
  await shoot("my-jobs", { household: page }, FOLDER);
  await context.close();
});

test("a Hindi household finds an electrician by tapping the choices", async ({ browser }) => {
  const worker = `Suresh ${RUN}`;
  listed.push(
    await listWorker(worker, ["electrician"], KORAMANGALA, RATE_PAISE, { area_name: "Koramangala", languages: [hi] }),
  );
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, { role: Role.consumer, name: `Kavita ${RUN}`, phone: newPhone(), address: "कोरमंगला", lang: hi });

  const log = page.getByRole("log");
  await expect(log).toContainText(t(hi, "need.start"));
  await tap(page, t(hi, "trade.electrician"));
  await expect(log).toContainText(t(hi, "question.problem"));
  await tap(page, t(hi, "iv.skip"));
  await tap(page, t(hi, "area.koramangala"));
  await tap(page, t(hi, "when.tomorrow"));
  // The budget is the one answer typed: it is a number, and private.
  await expect(log).toContainText(t(hi, "need.ask.budget"));
  await say(page, hi, "800");
  await expect(log).toContainText(textOf(hi, "need.summary", { trade: t(hi, "trade.electrician") }));
  await tap(page, t(hi, "flag.yes"));

  await askOnly(page, hi, worker);
  await onScreen(page, "nav.my_jobs", hi);
  // Tapped together, the need is the trade's name, as the worker will read it.
  await reveal(page, page.getByText(t(hi, "trade.electrician"), { exact: true }).first());

  // Back on Find, a new need starts afresh.
  await open(page, "nav.find", hi);
  await expect(log).toContainText(t(hi, "need.start"));
  await expect(log).not.toContainText(t(hi, "need.asked"));
  await context.close();
});
