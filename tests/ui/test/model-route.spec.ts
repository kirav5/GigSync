import { priceText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { greeting, newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";

/**
 * The phone's own model names what the chat asks (ADR 0040). The page's model is a fake standing in for Ollama, the
 * dev build's local model: it answers the routing prompt with a market question for "is ₹8,000 fair for a cook?",
 * which the word lists never heard (they take a stated amount for a budget), and gives nothing for anything else, so
 * the answer is the template's. Talk and Find both answer from the estimate, saying where ₹8,000 falls.
 */

const { en } = Lang.enum;
const FOLDER = "model-route";
const QUESTION = "is ₹8,000 fair for a cook?";
const AMOUNT_PAISE = 800_000;
const OLLAMA_GENERATE = "http://localhost:11434/api/generate";
/** How the routing prompt starts (packages/core/src/router/model-prompt.ts). */
const ROUTE_PROMPT = /^Sort one chat message/;
const MARKET_REPLY = JSON.stringify({ intent: "market", trade: "cook", amount: 8000 });
/** The Settings choice that sends every model call to Ollama, kept where the app keeps it. */
const MODEL_SETTING = { key: "CapacitorStorage.settings:model", value: { choice: "ollama", ollamaModel: "fake" } };

/** A phone whose model is the fake, and a count of the routing prompts it was asked. */
async function fakeModel(page: Page): Promise<{ routed: () => number }> {
  let routed = 0;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), MODEL_SETTING);
  await page.route(OLLAMA_GENERATE, async (route) => {
    const { prompt } = route.request().postDataJSON() as { prompt: string };
    const routing = ROUTE_PROMPT.test(prompt);
    if (routing) routed++;
    const response = routing && prompt.includes(JSON.stringify(QUESTION)) ? MARKET_REPLY : "";
    await route.fulfill({ json: { response }, headers: { "access-control-allow-origin": "*" } });
  });
  return { routed: () => routed };
}

/**
 * The answer: the month's range for a cook, then where ₹8,000 falls in it. The range itself is the API's to say, and
 * market.spec.ts seeds cooking jobs while this runs, so it is matched by its shape, not its numbers.
 */
const RANGE = textOf(en, "estimate.range_month", { trade: t(en, "trade.cook") });
const AMOUNT = new RegExp(
  (["estimate.amount_below", "estimate.amount_within", "estimate.amount_above"] as const)
    .map((key) => textOf(en, key, { amount: priceText(AMOUNT_PAISE) }).source)
    .join("|"),
);
const log = (page: Page) => page.getByRole("log");

test("Talk answers a market question only the model heard", async ({ page }) => {
  const model = await fakeModel(page);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();

  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  await box.getByPlaceholder(t(en, "composer.ask")).fill(QUESTION);
  await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
  await expect(log(page).getByText(QUESTION)).toBeVisible();
  await expect(log(page)).toContainText(RANGE);
  await expect(log(page)).toContainText(AMOUNT);
  expect(model.routed()).toBeGreaterThan(0);
  await shoot("talk", { worker: page }, FOLDER);
});

test("Find answers it too, and the need waits", async ({ page }) => {
  const model = await fakeModel(page);
  await signIn(page, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "Jayanagar", lang: en });
  await open(page, "nav.find");
  await expect(greeting(page, en)).toBeVisible();
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(QUESTION);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
  await expect(log(page).getByText(QUESTION)).toBeVisible();
  await expect(log(page)).toContainText(RANGE);
  await expect(log(page)).toContainText(AMOUNT);
  await expect(log(page).getByText(textOf(en, "need.ask.budget"))).toHaveCount(0);
  expect(model.routed()).toBeGreaterThan(0);
  await shoot("find", { household: page }, FOLDER);
});
