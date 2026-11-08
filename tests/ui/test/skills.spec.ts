import { plural, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { pickOnly, say } from "./findChat.js";
import { newPhone, open, openCard, Role, RUN, shoot, signIn, textOf } from "./helpers.js";
import { reveal } from "./jobs.js";
import { cleanUpLater, unlistCards } from "./journey.js";

/**
 * Work outside the trades (ADR 0047): a worker lists a skill in her own words on My card, and a household who asks for
 * that work in Find's chat finds her on the board, with no estimate, and asks her; her agent asks nothing it was told.
 * The household's words are matched on the phone against the board's skill list; only the skill's key is searched.
 */

const { en } = Lang.enum;
const SKILL = "Saree pleating";
const FOLDER = "skills";

let contexts: BrowserContext[] = [];
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

const log = (page: Page) => page.getByRole("log");
const tap = (page: Page, label: string) => log(page).getByRole("button", { name: label, exact: true }).last().click();

test("a worker lists her own skill and a household who asks for it finds and asks her", async ({ browser }) => {
  // ── Lakshmi makes her card with work that is on no list ───────────────────────────────────────────────────────
  const lakshmi = await phone(browser);
  const name = `Lakshmi ${RUN}`;
  await signIn(lakshmi, { role: Role.worker, name, phone: newPhone(), lang: en });
  await openCard(lakshmi, en);
  const form = lakshmi.getByRole("form", { name: t(en, "a11y.my_card") });
  const own = form.getByLabel(t(en, "card.skill_label"));
  const add = form.getByRole("button", { name: t(en, "card.skill_add"), exact: true });

  // Words that are clearly a trade pick the trade, which keeps its prices; she did not mean it, so she unpicks it.
  await own.fill("Bijli ka kaam");
  await add.click();
  await expect(form.getByRole("status")).toHaveText(t(en, "skill.is_trade", { trade: t(en, "trade.electrician") }));
  const electrician = form.getByRole("button", { name: t(en, "trade.electrician"), exact: true });
  await expect(electrician).toHaveAttribute("aria-pressed", "true");
  await electrician.click();
  // A phone number is not work: the board would refuse it, and the phone says why first.
  await own.fill("Call 98450 12345");
  await add.click();
  await expect(form.getByRole("status")).toHaveText(t(en, "skill.err.characters"));
  // Her own work, kept in her words; Enter adds it and does not publish the card.
  await own.fill(SKILL);
  await own.press("Enter");
  await expect(form.getByRole("button", { name: t(en, "card.skill_remove", { skill: SKILL }) })).toBeVisible();

  await form.getByLabel(t(en, "card.where")).selectOption({ label: t(en, "area.koramangala") });
  await form.getByLabel(t(en, "card.rate")).fill("600");
  await form.getByLabel(t(en, "card.min")).fill("450");
  await lakshmi.getByRole("button", { name: t(en, "card.publish"), exact: true }).click();
  cleanUpLater({ page: lakshmi, lang: en });
  const onBoard = t(en, "card.on_board", { trades: SKILL, area: "Koramangala", price: "₹600" });
  await expect(lakshmi.getByRole("status").filter({ hasText: onBoard })).toBeVisible();
  await shoot("card", { worker: lakshmi }, FOLDER);

  // ── Meena asks for it in her own words ─────────────────────────────────────────────────────────────────────────
  const meena = await phone(browser);
  await signIn(meena, {
    role: Role.consumer,
    name: `Meena ${RUN}`,
    phone: newPhone(),
    address: "Flat 2, Koramangala",
    lang: en,
  });
  const household = { page: meena, lang: en };
  await expect(log(meena)).toContainText(t(en, "need.start"));
  await say(household, "Need someone for saree pleating");
  // Matched on her phone to the skill Lakshmi listed; what the work is comes first, as there is no trade to go by.
  await expect(log(meena)).toContainText(t(en, "need.skill_found", { skill: SKILL }));
  await expect(log(meena)).toContainText(t(en, "question.job"));
  await say(household, "Pleat and pin two silk sarees for a wedding");
  // Work of a worker's own may be done any way, so how long is asked, with no model here to narrow it (ADR 0051).
  await expect(log(meena)).toContainText(t(en, "need.ask.arrangement"));
  await tap(meena, t(en, "need.arr.visit"));
  await expect(log(meena)).toContainText(t(en, "need.ask.address"));
  await tap(meena, t(en, "addr.chip", { label: t(en, "addr.label.home"), area: "Koramangala" }));
  await tap(meena, t(en, "when.tomorrow"));
  await tap(meena, t(en, "when.any_time"));
  // No estimate for work GigSync has no prices for: the budget is hers alone, and the chat says why.
  await expect(log(meena)).toContainText(t(en, "need.skill_no_rate"));
  await say(household, "700");

  await expect(log(meena)).toContainText(textOf(en, "need.summary", { trade: SKILL }));
  await shoot("readback", { household: meena }, FOLDER);
  await tap(meena, t(en, "flag.yes"));
  await pickOnly(household, name);
  const found = meena.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();

  // The job is for her skill, by its name, on both phones.
  await open(meena, "nav.activity", en);
  await reveal(meena, meena.getByRole("main").getByText(SKILL, { exact: true }).first(), en);
  await open(lakshmi, "nav.activity", en);
  await reveal(lakshmi, lakshmi.getByRole("main").getByText(SKILL, { exact: true }).first(), en);
  // Meena's words said what the work is, so Lakshmi's agent asks nothing more (never how long it takes, ADR 0063):
  // the agents agree, and one of them is asked to sign.
  const sign = (page: Page) => page.getByRole("button", { name: textOf(en, "job.sign") });
  await expect
    .poll(async () => (await sign(meena).isVisible()) || (await sign(lakshmi).isVisible()), { timeout: 60_000 })
    .toBe(true);
  await expect(meena.getByRole("form", { name: t(en, "a11y.answer") })).toHaveCount(0);
  await shoot("asked", { household: meena, worker: lakshmi }, FOLDER);
});
