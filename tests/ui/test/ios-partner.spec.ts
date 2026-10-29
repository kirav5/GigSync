import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { newPhone, Role, RUN, SHOTS, signIn, textOf } from "./helpers.js";
import { fillAsk, type Phone } from "./journey.js";

/**
 * The household's half of the iPhone journey. Playwright cannot reach the web view inside an iOS app, so the worker's
 * half runs by hand (or by an agent) on the iPhone simulator: sign in, publish a cook's card with "ask me first" for
 * pets, then start this with the name used there. It asks, answers her questions, signs when its phone asks, and
 * waits for her note, taking a screenshot at each step:
 *   IOS_PARTNER="Asha 123" HOUSEHOLD_LANG=en pnpm exec playwright test ios-partner --project=chromium
 */

const WORKER = process.env.IOS_PARTNER;
const lang = Lang.parse(process.env.HOUSEHOLD_LANG ?? Lang.enum.en);
/**
 * The household's own words, in its language; numbers stay so the phone's translation check has something to keep.
 * The day is the "Every day" chip (a cook's default), and `time` goes with it.
 */
const WORDS: Partial<Record<Lang, { need: string; time: string; meals: string }>> = {
  en: { need: "Need a cook for breakfast and dinner", time: "Mon–Sat 7–10", meals: "breakfast and dinner" },
  kn: { need: "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು", time: "ಸೋಮ–ಶನಿ 7–10", meals: "ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ" },
};
/** The worker taps through on a phone by hand, so each wait allows for a person's pace. */
const HUMAN_MS = 900_000;

test.skip(!WORKER, "drives only the household; the worker runs on the iPhone simulator (IOS_PARTNER=<her name>)");

test("household asks the iPhone worker, answers, signs and reads her note", async ({ page }) => {
  test.setTimeout(HUMAN_MS * 4);
  const words = WORDS[lang];
  if (!WORKER || !words) throw new Error(`no words for ${lang}`);
  const home: Phone = { page, lang };
  const shot = (name: string) => page.screenshot({ path: `${SHOTS}ios/household-${name}.png`, fullPage: true });

  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address: "Koramangala", lang });
  await fillAsk(home, {
    trade: "cook",
    area: "Koramangala",
    worker: WORKER,
    budget: "9500",
    when: "when.daily",
    ...words,
  });
  await page.getByRole("button", { name: plural(lang, "find.ask", 1) }).click();
  await shot("01-asked");

  const answer = page.getByRole("form", { name: t(lang, "a11y.answer") });
  await expect(answer).toBeVisible({ timeout: HUMAN_MS });
  await answer.getByLabel(questionText(lang, "people")).fill("3");
  await answer.getByLabel(questionText(lang, "meals")).fill(words.meals);
  await answer.getByLabel(questionText(lang, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(lang, "job.send_answers") }).click();
  await shot("02-answered");

  const sign = page.getByRole("group", { name: t(lang, "a11y.sign") });
  await expect(sign).toBeVisible({ timeout: HUMAN_MS });
  await shot("03-sign");
  await sign.getByRole("button", { name: textOf(lang, "job.sign") }).click();
  await expect(page.getByLabel(t(lang, "a11y.contact"))).toBeVisible({ timeout: HUMAN_MS });
  await shot("04-signed");

  await expect(page.getByRole("list", { name: t(lang, "a11y.notes") }).locator("li")).not.toHaveCount(0, {
    timeout: HUMAN_MS,
  });
  await shot("05-note");
});
