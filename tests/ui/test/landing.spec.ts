import { readFileSync } from "node:fs";
import { cashPlan, FixedItem, t } from "@gigsync/core";
import { CityGuide, Lang, PAISE_PER_RUPEE } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, openFold, Role, RUN, shoot, signIn } from "./helpers.js";
import { type } from "./talk.js";

/**
 * Moving to a new city (round 4, flow 3), through the real screens and the real API: Talk hears "I'm moving to
 * Bengaluru" and opens the landing journey with the city picked; the owner picks the day and their work; the guide
 * carries the draft label; an item is ticked; "where can I stay" answers with the first-nights hostels and their
 * sources; places and the cash plan open; and with the network off, the same journey and guide still open and answer.
 */

const { en } = Lang.enum;
const FOLDER = "landing";
const ARRIVAL = "2026-11-16";
/** The guide the API serves, read from the same file, so the cash plan's total can be checked to the rupee. */
const GUIDE = CityGuide.parse(
  JSON.parse(readFileSync(new URL("../../../workers/api/content/bengaluru.json", import.meta.url), "utf8")),
);
const HOSTELS = GUIDE.sections.find((s) => s.id === "first-nights-women-hostels");
const BANK = GUIDE.sections.find((s) => s.id === "bank-account-current-address");

/** ₹ as the app shows money: Indian grouping, no paise when whole. */
const rupees = (paise: number) => `₹${(paise / PAISE_PER_RUPEE).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

let context: BrowserContext | undefined;
test.afterAll(async () => {
  await context?.close();
});

/** Asks the guide through the dock's composer, as typing in Talk does. */
async function ask(page: Page, question: string) {
  const box = page.getByRole("form", { name: t(en, "landing.ask_title") });
  await box.getByRole("textbox").fill(question);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

const answer = (page: Page) => page.getByRole("region", { name: t(en, "landing.ask_title") });

test("a worker moving to Bengaluru gets the journey, the guide's answers and places, and keeps them offline", async ({
  browser,
}) => {
  if (!HOSTELS || !BANK) throw new Error("the guide lost a section this test reads");
  context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone(), lang: en });

  // ── Talk hears the move. A worker with no card lands on the card interview; "Later" pauses it ───────────────
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();
  await type(page, en, "I'm moving to Bengaluru");
  await expect(page.getByRole("heading", { name: t(en, "landing.title") })).toBeVisible();
  const start = page.getByRole("form", { name: t(en, "landing.start_title") });
  await expect(start.getByRole("button", { name: t(en, "landing.city.bengaluru") })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await start.getByLabel(t(en, "landing.arrival")).fill(ARRIVAL);
  await start.getByRole("button", { name: t(en, "trade.maid") }).click();
  await shoot("start", { worker: page }, FOLDER);
  await start.getByRole("button", { name: t(en, "landing.start") }).click();

  // ── The journey, under the draft label ─────────────────────────────────────────────────────────────────────
  await expect(page.getByRole("note")).toContainText(t(en, "landing.draft"));
  const steps = page.getByRole("region", { name: t(en, "landing.steps") });
  await expect(steps.getByRole("heading", { name: t(en, "landing.step.planning") })).toBeVisible();
  const money = steps.getByRole("checkbox", { name: t(en, `landing.fixed_${FixedItem.money}`) });
  await money.check();
  await expect(money).toBeChecked();
  await expect(steps).toContainText(t(en, "landing.done_count", { done: 1, total: 3 }));

  // ── Ask the guide: the hostels section as written, with its sources ────────────────────────────────────────
  await ask(page, "where can I stay");
  await expect(answer(page).getByRole("heading", { name: HOSTELS.title })).toBeVisible();
  await expect(answer(page)).toContainText(HOSTELS.body);
  const source = HOSTELS.sources[0];
  if (!source) throw new Error("the hostels section has no source");
  await expect(answer(page).getByRole("link", { name: new RegExp(source.title.slice(0, 20)) })).toHaveAttribute(
    "href",
    source.url,
  );
  await shoot("ask-stay", { worker: page }, FOLDER);

  // ── A question the guide has nothing on says so ───────────────────────────────────────────────────────────
  await ask(page, "where can I buy a saree");
  await expect(answer(page)).toContainText(t(en, "landing.no_answer"));

  // ── Places, listed from public sources and not vouched for ────────────────────────────────────────────────
  await page.getByText(t(en, "landing.places"), { exact: true }).click();
  const places = page.getByRole("region", { name: t(en, "landing.places") });
  await expect(places).toContainText(t(en, "landing.places_note"));
  await expect(places).toContainText(GUIDE.places[0]?.name ?? "");

  // ── The cash plan: an estimate from the draft guide, to the rupee ─────────────────────────────────────────
  await page.getByText(t(en, "landing.cash_title"), { exact: true }).click();
  const cash = page.getByRole("region", { name: t(en, "landing.cash_title") });
  const plan = cashPlan(GUIDE.costs, ARRIVAL);
  await expect(cash).toContainText(t(en, "landing.cash_total", { amount: rupees(plan.total_paise) }));
  await expect(cash).toContainText(t(en, "landing.not_known"));
  await shoot("places-cash", { worker: page }, FOLDER);

  // ── Offline: the move and the guide downloaded earlier open again and still answer ────────────────────────
  await context.setOffline(true);
  await open(page, "nav.profile");
  await openFold(page, "profile.new_city");
  await page.getByRole("button", { name: t(en, "landing.open") }).click();
  await expect(page.getByRole("note")).toContainText(t(en, "landing.draft"));
  await expect(steps.getByRole("checkbox", { name: t(en, `landing.fixed_${FixedItem.money}`) })).toBeChecked();
  await ask(page, "how do I open a bank account");
  await expect(answer(page).getByRole("heading", { name: BANK.title })).toBeVisible();
  await shoot("offline", { worker: page }, FOLDER);
  await context.setOffline(false);

  // ── Someone who knows the city: the mentor screens open from the journey ──────────────────────────────────
  await page.getByRole("button", { name: t(en, "landing.mentor") }).click();
  await expect(page.locator(".topbar-title")).toHaveText(t(en, "mentor.find"));
});
