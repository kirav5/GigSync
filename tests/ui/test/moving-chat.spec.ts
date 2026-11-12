import { readFileSync } from "node:fs";
import { t } from "@gigsync/core";
import { CityGuide, Lang, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS, PlaceKind } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";
import { type Phone, publishCard, unlistCards } from "./journey.js";
import { seedRecord } from "./mentor-seed.js";
import { type } from "./talk.js";

/**
 * Moving to a new city, driven entirely through Talk (no menu to find): a worker who has helped in Bengaluru for months
 * says "I can help people new to Bengaluru" and answers the listing's questions in the chat; a cook says "I'm moving
 * to Bengaluru" and gets the usual pay for cooks there with what it rests on, what to sort first, the guide's hostels on
 * "Where to stay", the bank section for her own question, and the listed worker under "Find someone who knows the
 * city", whom she asks. Profile no longer has a New city fold.
 */

const { en } = Lang.enum;
const FOLDER = "moving-chat";
/** The seeded record: past the minimum, and more jobs than another run's mentor, so the match lists her first. */
const JOBS_DONE = 45;
const DAYS_OF_WORK = 250;
const MONTHS_OF_WORK = 8;
const GUIDE = CityGuide.parse(
  JSON.parse(readFileSync(new URL("../../../workers/api/content/bengaluru.json", import.meta.url), "utf8")),
);
const HOSTELS = GUIDE.sections.find((s) => s.id === "first-nights-women-hostels");
const BANK = GUIDE.sections.find((s) => s.id === "bank-account-current-address");

let contexts: BrowserContext[] = [];
/** A mentor listed in this run, taken off the shared list whatever happens. */
let listed: Phone | undefined;

test.afterEach(async () => {
  if (listed && !listed.page.isClosed()) {
    try {
      await open(listed.page, "nav.talk");
      await type(listed.page, en, "stop helping newcomers");
      await expect(listed.page.getByText(t(en, "moving.unlisted"))).toBeVisible({ timeout: 15_000 });
    } catch {
      // The page is gone or stuck; nothing more can be done from here.
    }
  }
  listed = undefined;
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** Taps a chip or button in Talk's conversation by its words. */
const tap = (page: Page, key: Parameters<typeof t>[1], params = {}) =>
  page
    .getByRole("log")
    .getByRole("button", { name: t(en, key, params), exact: true })
    .click();

test("a cook moving to Bengaluru gets the outlook, the guide's answers and a mentor, all in Talk", async ({
  browser,
}) => {
  if (!HOSTELS || !BANK) throw new Error("the guide lost a section this test reads");
  contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [mentorPage, cookPage] = await Promise.all(contexts.map((c) => c.newPage()));
  if (!mentorPage || !cookPage) throw new Error("no page");
  const mentor: Phone = { page: mentorPage, lang: en };
  const cook: Phone = { page: cookPage, lang: en };
  const shots = { mentor: mentorPage, newcomer: cookPage };
  const mentorName = `Meena${RUN}`;

  await signIn(mentorPage, { role: Role.worker, name: mentorName, phone: newPhone(), lang: en });
  await signIn(cookPage, { role: Role.worker, name: `Kavya ${RUN}`, phone: newPhone(), lang: en });
  await publishCard(mentor, {
    trade: t(en, "trade.cook"),
    area: "koramangala",
    rate: "9000",
    min: "8000",
    about: "Meals",
  });
  await publishCard(cook, {
    trade: t(en, "trade.cook"),
    area: "indiranagar",
    rate: "9000",
    min: "8000",
    about: "Meals",
  });

  // ── The mentor offers to help, in Talk: the listing's questions as chips, a summary, and List me ─────────────────
  await seedRecord(mentorPage, JOBS_DONE, DAYS_OF_WORK);
  await open(mentorPage, "nav.talk");
  await type(mentorPage, en, "I can help people new to Bengaluru");
  await tap(mentorPage, "area.koramangala");
  await tap(mentorPage, "moving.done");
  await tap(mentorPage, "mentor.no");
  await tap(mentorPage, "moving.slots", { n: 2 });
  await expect(mentorPage.getByRole("log")).toContainText(t(en, "mentor.offer_about"));
  await shoot("mentor-confirms", shots, FOLDER);
  await tap(mentorPage, "moving.list_yes");
  listed = mentor;
  const city = { city: t(en, "mentor.city.bengaluru") };
  await expect(mentorPage.getByText(t(en, "mentor.listed", city))).toBeVisible();

  // ── The cook says she is moving: the outlook for cooks there, what it rests on, and what to sort first ──────────
  await open(cookPage, "nav.talk");
  await expect(cookPage.getByRole("button", { name: t(en, "moving.suggest"), exact: true })).toBeVisible();
  await type(cookPage, en, "I'm moving to Bengaluru");
  const log = cookPage.getByRole("log");
  // The cook's range at the default scope (ADR 0041): GigSync's jobs blended with the city's rate card when the shared
  // database holds enough, else the rate card alone; either way the line names the rate card.
  await expect(log).toContainText(textOf(en, "estimate.range_month", { trade: t(en, "trade.cook") }));
  await expect(log).toContainText(t(en, "driver.basis.rate_card", { city: t(en, "city.bengaluru"), sources: "" }));
  await expect(log).toContainText(textOf(en, "estimate.legal_min"));
  await expect(log).toContainText(t(en, "moving.estimates"));
  await expect(log).toContainText(t(en, "moving.first", { city: t(en, "city.bengaluru") }));
  await expect(log).toContainText(HOSTELS.title);
  await shoot("outlook", shots, FOLDER);

  // ── Where to stay: the guide's hostels section as written, with its source, and the places it lists ─────────────
  await tap(cookPage, "moving.stay");
  const answer = log.getByRole("region", { name: t(en, "landing.ask_title") }).last();
  await expect(answer.getByRole("heading", { name: HOSTELS.title })).toBeVisible();
  const source = HOSTELS.sources[0];
  if (!source) throw new Error("the hostels section has no source");
  await expect(answer.getByRole("link", { name: new RegExp(source.title.slice(0, 20)) })).toHaveAttribute(
    "href",
    source.url,
  );
  await expect(answer).toContainText(
    t(en, "moving.places", { count: GUIDE.places.filter((p) => p.kind === PlaceKind.enum.housing).length }),
  );
  await shoot("where-to-stay", shots, FOLDER);

  // ── Her own question, in the same chat: the bank section ──────────────────────────────────────────────────────
  await type(cookPage, en, "how do I open a bank account");
  const bank = log.getByRole("region", { name: t(en, "landing.ask_title") }).last();
  await expect(bank.getByRole("heading", { name: BANK.title })).toBeVisible();
  await shoot("bank", shots, FOLDER);

  // ── Someone who knows the city: the women-only question once, then the listed mentor, then Ask ────────────────
  await tap(cookPage, "moving.find");
  await tap(cookPage, "mentor.no");
  const ask = cookPage.getByRole("button", { name: t(en, "moving.ask", { name: mentorName }) });
  await expect(ask).toBeVisible();
  const card = cookPage.getByRole("listitem").filter({ has: ask });
  await expect(card).toContainText(t(en, "mentor.says", { jobs: JOBS_DONE, months: MONTHS_OF_WORK }));
  await shoot("mentor-found", shots, FOLDER);
  await ask.click();
  await expect(log).toContainText(t(en, "mentor.safety_money"));
  await tap(cookPage, "mentor.safety_ok");
  await tap(cookPage, "moving.arrive_1");
  await expect(log).toContainText(t(en, "moving.sent", { name: mentorName }));
  await shoot("asked", shots, FOLDER);

  // ── The mentor sees the request on Home ──────────────────────────────────────────────────────────────────────
  await open(mentorPage, "nav.home");
  await expect(mentorPage.getByRole("button", { name: t(en, "mentor.help", { name: `Kavya ${RUN}` }) })).toBeVisible();

  // ── About me has nothing about cities any more ──────────────────────────────────────────────────────────────
  await open(cookPage, "nav.about");
  await expect(cookPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(cookPage.getByText(t(en, "landing.title"))).toHaveCount(0);
  await expect(cookPage.getByText(t(en, "mentor.find"))).toHaveCount(0);
  await shoot("profile", shots, FOLDER);
});

test("a worker without enough signed work is told why, and a move to a city without a guide says so", async ({
  browser,
}) => {
  contexts = [await browser.newContext()];
  const page = await contexts[0]?.newPage();
  if (!page) throw new Error("no page");
  await signIn(page, { role: Role.worker, name: `Ravi ${RUN}`, phone: newPhone(), lang: en });
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();
  await type(page, en, "I can help people new to Bengaluru");
  await expect(page.getByRole("log")).toContainText(
    t(en, "moving.not_eligible", { min_months: MENTOR_MIN_MONTHS, min_jobs: MENTOR_MIN_JOBS, jobs: 0, months: 0 }),
  );
  await type(page, en, "I'm moving to Chennai");
  await expect(page.getByRole("log")).toContainText(t(en, "moving.no_guide"));
  await expect(page.getByRole("log")).toContainText(t(en, "moving.line.emergency"));
  await shoot("no-guide", { worker: page }, FOLDER);
});
