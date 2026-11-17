import { HttpMethod, t } from "@gigsync/core";
import { BoardProfile, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { API, newPhone, openCard, Role, RUN, signIn, textOf } from "./helpers.js";
import { cleanUpLater, unlistCards } from "./journey.js";

/**
 * A rate for each kind of work (ADR 0062): an electrician who also repairs fridges sets a price for fridges on My card.
 * The board gets it as the fridge rate of its own, and the form shows it again when she comes back.
 */

const { en } = Lang.enum;
const BOARD_PROFILE = `${API}/v1/board/profile`;
const FRIDGE = t(en, "category.fridge_repair");

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

test("an electrician gives fridge repair a rate of its own, and the board keeps it", async ({ browser }) => {
  const context = await browser.newContext();
  contexts.push(context);
  const page: Page = await context.newPage();
  await signIn(page, { role: Role.worker, name: `Ravi ${RUN}`, phone: newPhone(), lang: en });
  await openCard(page, en);
  const form = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await form.getByRole("button", { name: t(en, "trade.electrician"), exact: true }).click();
  await form.getByText(t(en, "card.all_work")).click();
  await form.getByRole("button", { name: FRIDGE, exact: true }).click();
  await form.getByLabel(t(en, "card.where")).selectOption({ label: t(en, "area.koramangala") });
  await form.getByLabel(t(en, "card.rate")).fill("300");
  await form.getByLabel(t(en, "card.min")).fill("250");
  // A kind left blank would be at the card's rate; fridges are dearer.
  const rates = form.getByRole("group", { name: t(en, "card.work_rates") });
  await rates.getByLabel(t(en, "card.work_rate", { work: FRIDGE })).fill("600");

  const sent = page.waitForResponse((r) => r.url() === BOARD_PROFILE && r.request().method() === HttpMethod.put);
  await page.getByRole("button", { name: t(en, "card.publish"), exact: true }).click();
  cleanUpLater({ page, lang: en });
  const card = BoardProfile.parse((await sent).request().postDataJSON());
  expect(card.rate_paise).toBe(30000);
  expect(card.work_rates).toEqual([{ skill: "fridge repair", rate_paise: 60000 }]);
  await expect(page.getByRole("status").filter({ hasText: textOf(en, "card.on_board") })).toBeVisible();

  await page.reload();
  await openCard(page, en);
  const again = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await expect(again.getByLabel(t(en, "card.work_rate", { work: FRIDGE }))).toHaveValue("600");
});
