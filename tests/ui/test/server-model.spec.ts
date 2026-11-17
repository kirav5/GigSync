import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { tellNeed } from "./findChat.js";
import { API, newPhone, Role, RUN, signIn } from "./helpers.js";

/**
 * GigSync's own model (ADR 0052), with the API's answers stood in for: test runs have no Mac Studio. When the API has
 * a model, Auto asks it; the budget, a secret answer, is never in what is sent. When the API has none, nothing is sent at all.
 */

const { en } = Lang.enum;
/** A budget no other part of the conversation would say. */
const BUDGET = "777";
/** The prompts the app sends to GigSync's model; the model "answers" nothing, so the phone falls back every time. */
async function serverModel(page: Page, on: boolean): Promise<string[]> {
  const prompts: string[] = [];
  await page.route(`${API}/v1/model/status`, (route) => route.fulfill({ json: { on } }));
  await page.route(`${API}/v1/model/generate`, (route) => {
    prompts.push(String(route.request().postDataJSON()?.prompt ?? ""));
    return route.fulfill({ json: { text: null } });
  });
  return prompts;
}

const household = (page: Page) =>
  signIn(page, {
    role: Role.consumer,
    name: `Asha Model ${RUN}`,
    phone: newPhone(),
    address: "Flat 4, 2nd Main",
    area: "HSR Layout",
  });

const need = {
  need: "Need a plumber, the kitchen tap leaks",
  area: "HSR Layout",
  when: "when.tomorrow" as const,
  budget: BUDGET,
};

test("with a model on the API, Auto asks it, and the budget is never sent", async ({ page }) => {
  const prompts = await serverModel(page, true);
  await household(page);
  await tellNeed({ page, lang: en }, need);
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts.join("\n")).not.toContain(BUDGET);
});

test("without a model on the API, nothing is sent and the phone answers by rules, unnamed", async ({ page }) => {
  const prompts = await serverModel(page, false);
  await household(page);
  await tellNeed({ page, lang: en }, need);
  expect(prompts).toEqual([]);
});
