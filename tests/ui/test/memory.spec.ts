import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, reveal, shoot, signIn } from "./helpers.js";
import { type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * What the agent remembers, through the real screens and the real API: after a job both signed, Profile lists what
 * the household's agent kept, Forget removes one item, and the next request offers the remembered detail as a chip
 * while the worker's question the household answered last time is answered from memory.
 */

const { en } = Lang.enum;
const FOLDER = "memory";
const ROOMS = "3 rooms, sweeping and mopping";
const BUDGET = "7000";

let contexts: BrowserContext[] = [];

test.afterAll(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** The chat's box, where the owner types their answers. */
async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

/** Taps a choice under the newest question. */
const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).click();

/** Ticks only `name` among the workers found, then asks them. */
async function askOnly(page: Page, name: string) {
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name }) }).check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
}

/** The household's Profile section that lists what their agent remembers. */
const memorySection = (page: Page) => page.getByRole("region", { name: t(en, "memory.title") });

test("after a signed job the agent remembers, forgets on request, and answers from memory next time", async ({
  browser,
}) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [meenaPage, priyaPage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const meena: Phone = { page: meenaPage, lang: en };
  const priya: Phone = { page: priyaPage, lang: en };
  const meenaName = `Meena ${RUN}`;
  const meenaPhone = newPhone();

  await signIn(meenaPage, { role: Role.worker, name: meenaName, phone: meenaPhone, lang: en });
  await signIn(priyaPage, {
    role: Role.consumer,
    name: `Priya ${RUN}`,
    phone: newPhone(),
    address: `Flat 9, HSR Layout (${RUN})`,
    lang: en,
  });
  await publishCard(meena, {
    trade: t(en, "trade.maid"),
    area: "hsr_layout",
    rate: "7000",
    min: "5000",
    about: "Rooms",
  });

  // ── First job: nothing remembered yet, so the chat asks the rooms and the area blind ─────────────────────────
  await open(priyaPage, "nav.profile");
  await expect(memorySection(priyaPage)).toContainText(t(en, "memory.empty"));
  await open(priyaPage, "nav.find");
  const log = priyaPage.getByRole("log");
  await expect(log).toContainText(t(en, "need.start"));
  await tap(priyaPage, t(en, "trade.maid"));
  await expect(log).toContainText(t(en, "question.rooms"));
  await say(priyaPage, ROOMS);
  await expect(log.getByRole("button", { name: /^Same as last time/ })).toHaveCount(0);
  await tap(priyaPage, t(en, "area.hsr_layout"));
  await say(priyaPage, BUDGET);
  await tap(priyaPage, t(en, "flag.yes"));
  await askOnly(priyaPage, meenaName);

  // Meena's agent asks about pets; Priya answers, and both sign.
  await open(meenaPage, "nav.today");
  await open(priyaPage, "nav.my_jobs");
  const answer = priyaPage.getByRole("form", { name: t(en, "a11y.answer") });
  await expect(answer.getByLabel(questionText(en, "pets"))).toBeVisible();
  await answer.getByLabel(questionText(en, "pets")).selectOption("no");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();
  await signBoth({ worker: meena, customer: priya }, FOLDER);
  await open(priyaPage, "nav.my_jobs");
  await expect(priyaPage.getByLabel(t(en, "a11y.contact"))).toContainText(meenaName);

  // ── Profile lists what her agent kept: the rooms, the pets, the area and Meena by name, never Meena's phone ──
  await open(priyaPage, "nav.profile");
  const remembered = memorySection(priyaPage);
  for (const text of [ROOMS, t(en, "area.hsr_layout"), meenaName, plural(en, "memory.jobs", 1)])
    await expect(remembered).toContainText(text);
  await expect(remembered).not.toContainText(meenaPhone);
  await shoot("profile-remembers", { household: priyaPage }, FOLDER);
  // She forgets the area; the rest stays.
  const areaRow = remembered.locator('[data-memory="area:area"]');
  await areaRow.getByRole("button", { name: t(en, "memory.forget") }).click();
  await expect(areaRow).toHaveCount(0);
  await expect(remembered).toContainText(ROOMS);

  // ── Second request: the rooms are a "same as last time" chip; the forgotten area is not offered ──────────────
  await open(priyaPage, "nav.find");
  await expect(log).toContainText(t(en, "need.start"));
  await tap(priyaPage, t(en, "trade.maid"));
  const same = t(en, "memory.same_value", { value: ROOMS });
  await expect(log.getByRole("button", { name: same, exact: true })).toBeVisible();
  await shoot("same-as-last-time", { household: priyaPage }, FOLDER);
  await tap(priyaPage, same);
  await expect(log.getByRole("button", { name: /^Same as last time/ })).toHaveCount(0);
  await tap(priyaPage, t(en, "area.hsr_layout"));
  await say(priyaPage, BUDGET);
  await tap(priyaPage, t(en, "flag.yes"));
  await askOnly(priyaPage, meenaName);

  // Meena's agent asks about pets again; Priya's agent answers from her past job, and says so in the agents' talk.
  const fromMemory = priyaPage
    .getByRole("list", { name: t(en, "talk.title") })
    .getByText(t(en, "ask.from_memory"))
    .first();
  await reveal(priyaPage, fromMemory);
  await expect(answer).toHaveCount(0);
  await shoot("answered-from-memory", { household: priyaPage }, FOLDER);
});
