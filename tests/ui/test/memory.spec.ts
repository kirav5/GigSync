import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, openFold, Role, RUN, reveal, shoot, signIn } from "./helpers.js";
import { type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * What the agent remembers, through the real screens and the real API: after a job both signed, Profile lists what
 * the household's agent kept and Forget removes one item. With the default "Ask me first", the next request's agent
 * asks "From your last job … Use it?" and the worker's question answered last time comes filled in, sent with one
 * tap. Switched to "Answer for me" in Profile, the agent fills the detail in, says so, and offers to change it.
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
/** The remembered rooms, as the agent names them. */
const roomsParams = { detail: t(en, "detail.rooms"), value: ROOMS };

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
  await openFold(priyaPage, "profile.agent");
  await expect(memorySection(priyaPage)).toContainText(t(en, "memory.empty"));
  await open(priyaPage, "nav.find");
  const log = priyaPage.getByRole("log");
  await expect(log).toContainText(t(en, "need.start"));
  await tap(priyaPage, t(en, "trade.maid"));
  await expect(log).toContainText(t(en, "question.rooms"));
  await say(priyaPage, ROOMS);
  await expect(log.getByRole("button", { name: t(en, "memory.use"), exact: true })).toHaveCount(0);
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
  await openFold(priyaPage, "profile.agent");
  const remembered = memorySection(priyaPage);
  for (const text of [ROOMS, t(en, "area.hsr_layout"), meenaName, plural(en, "memory.jobs", 1)])
    await expect(remembered).toContainText(text);
  await expect(remembered).not.toContainText(meenaPhone);
  // The list is folded away so a long history never fills Profile; it opens from a row that counts what is kept.
  const fold = remembered.locator("details");
  await expect(fold).not.toHaveAttribute("open", "");
  await fold.locator("summary").click();
  await shoot("profile-remembers", { household: priyaPage }, FOLDER);
  // She forgets the area; the rest stays.
  const areaRow = remembered.locator('[data-memory="area:area"]');
  await areaRow.getByRole("button", { name: t(en, "memory.forget") }).click();
  await expect(areaRow).toHaveCount(0);
  await expect(remembered).toContainText(ROOMS);

  // ── Second request, "Ask me first": the agent asks about the rooms; the forgotten area is asked as usual ──────
  await expect(remembered.getByRole("button", { name: t(en, "memory.answer_ask") })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await open(priyaPage, "nav.find");
  await expect(log).toContainText(t(en, "need.start"));
  await tap(priyaPage, t(en, "trade.maid"));
  await expect(log).toContainText(t(en, "memory.offer_detail", roomsParams));
  await shoot("ask-first", { household: priyaPage }, FOLDER);
  await tap(priyaPage, t(en, "memory.use"));
  await expect(log).toContainText(t(en, "need.ask.area"));
  await expect(log).not.toContainText(t(en, "memory.offer_area", { area: t(en, "area.hsr_layout") }));
  await tap(priyaPage, t(en, "area.hsr_layout"));
  await say(priyaPage, BUDGET);
  await expect(log).toContainText(ROOMS);
  await tap(priyaPage, t(en, "flag.yes"));
  await askOnly(priyaPage, meenaName);

  // Meena's agent asks about pets again; the answer comes filled in from Priya's past job, and one tap sends it.
  await expect(answer).toContainText(t(en, "ask.memory_offer", { value: t(en, "flag.no") }));
  await shoot("answer-filled-in", { household: priyaPage }, FOLDER);
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();
  await expect(answer).toHaveCount(0);
  const fromMemory = priyaPage
    .getByRole("list", { name: t(en, "talk.title") })
    .getByText(t(en, "ask.from_memory"))
    .first();
  await reveal(priyaPage, fromMemory);
  await shoot("answered-from-memory", { household: priyaPage }, FOLDER);

  // ── "Answer for me": the agent fills the rooms in, says so, and Change asks the question again ───────────────
  await open(priyaPage, "nav.profile");
  await openFold(priyaPage, "profile.agent");
  await memorySection(priyaPage)
    .getByRole("button", { name: t(en, "memory.answer_auto") })
    .click();
  await expect(memorySection(priyaPage).getByRole("button", { name: t(en, "memory.answer_auto") })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await open(priyaPage, "nav.find");
  await expect(log).toContainText(t(en, "need.start"));
  await tap(priyaPage, t(en, "trade.maid"));
  await expect(log).toContainText(t(en, "memory.filled_detail", roomsParams));
  await expect(log).toContainText(t(en, "need.ask.area"));
  await shoot("answer-for-me", { household: priyaPage }, FOLDER);
  await tap(priyaPage, t(en, "memory.change_detail", { detail: t(en, "detail.rooms") }));
  await expect(log.getByText(t(en, "question.rooms"))).toHaveCount(1);
});
