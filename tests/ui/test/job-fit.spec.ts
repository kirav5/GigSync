import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, Role, RUN, shoot, signIn } from "./helpers.js";
import { openCard } from "./menu.js";

/**
 * Questions that fit the job (ADR 0051): Find opens on the household's own words with no grid of trades, asks a cook
 * as a cook is hired (one meal, some days a week, every month, never by the hour), and offers no "Every day" for one
 * meal; a cook's card offers the same three. Every phone here is one without the on-device model, as most pilot
 * phones are: the job's nature comes from GigSync's own table, in each language.
 */

const { en, hi, kn } = Lang.enum;
const FOLDER = "job-fit";
/** "I need a cook", in each language: the need names the trade, nothing else. */
const NEED: Readonly<Record<Lang, string>> = { en: "I need a cook", hi: "मुझे कुक चाहिए", kn: "ನನಗೆ ಅಡುಗೆಯವರು ಬೇಕು" };
const COOK_TAKES = ["need.arr.meal", "need.arr.weekly", "need.arr.monthly"] as const satisfies readonly MessageKey[];

const log = (page: Page) => page.getByRole("log");
const chip = (page: Page, lang: Lang, key: MessageKey) =>
  log(page).getByRole("button", { name: t(lang, key), exact: true });

async function say(page: Page, lang: Lang, words: string) {
  const box = page.getByRole("form", { name: t(lang, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(lang, "a11y.send") }).click();
}

for (const lang of [en, hi, kn]) {
  test(`Find asks a cook as a cook is hired, with no grid of trades first, in ${lang}`, async ({ page }) => {
    await signIn(page, { role: Role.consumer, name: `Kavya ${RUN}`, phone: newPhone(), address: "Flat 4, HSR", lang });
    await expect(log(page)).toContainText(t(lang, "need.start"));
    // The opening invites the need in her words, with one chip to the list for whoever cannot say or type it.
    await expect(chip(page, lang, "need.pick_work")).toBeVisible();
    await expect(chip(page, lang, "trade.cook")).toHaveCount(0);
    await shoot(`opening-${lang}`, { household: page }, FOLDER);

    await say(page, lang, NEED[lang]);
    await expect(log(page)).toContainText(t(lang, "question.people"));
    await say(page, lang, "8");
    await expect(log(page)).toContainText(t(lang, "need.ask.arrangement"));
    for (const key of COOK_TAKES) await expect(chip(page, lang, key)).toBeVisible();
    await expect(chip(page, lang, "need.arr.hourly")).toHaveCount(0);
    await shoot(`how-long-cook-${lang}`, { household: page }, FOLDER);

    // One meal is on one day: the day question offers no "Every day".
    await chip(page, lang, "need.arr.meal").click();
    await expect(log(page)).toContainText(t(lang, "need.ask.when"));
    await expect(chip(page, lang, "when.today")).toBeVisible();
    await expect(chip(page, lang, "when.daily")).toHaveCount(0);
    await shoot(`when-one-meal-${lang}`, { household: page }, FOLDER);
  });
}

test("a cook's card offers only the work a cook takes", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Lata ${RUN}`, phone: newPhone(), lang: en });
  await openCard(page, en);
  const form = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await form.getByRole("button", { name: t(en, "trade.cook"), exact: true }).click();
  const work = form.getByRole("group", { name: t(en, "card.arrangements") });
  for (const a of ["visit", "weekly", "monthly"] as const)
    await expect(work.getByRole("checkbox", { name: t(en, `arrangement.${a}`) })).toBeVisible();
  await expect(work.getByRole("checkbox", { name: t(en, "arrangement.hourly") })).toHaveCount(0);
  await shoot("cook-card", { worker: page }, FOLDER);
});
