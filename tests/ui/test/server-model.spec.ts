import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { tellNeed } from "./findChat.js";
import { API, newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * GigSync's own model (ADR 0052), with the API's answers stood in for: test runs have no Mac Studio. When the API has
 * a model, Auto asks it, Settings' chip says so and the Privacy page says who reads what the owner writes; the
 * budget, a secret answer, is never in what is sent. When the API has none, nothing is sent at all.
 */

const { en } = Lang.enum;
const FOLDER = "server-model";
/** A budget no other part of the conversation would say. */
const BUDGET = "777";
/** Settings' "Your agent runs on" row, whose chip says what answers; with no model answering, no row at all. */
async function engineSays(page: Page, key: "shell.model_server" | undefined) {
  await open(page, "nav.settings");
  const main = page.getByRole("main");
  if (key) await expect(main).toContainText(t(en, key));
  else await expect(main).not.toContainText(t(en, "me.agent_runs"));
  await open(page, "nav.find");
}

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

test("with a model on the API, Auto asks it, the Privacy page says so, and the budget is never sent", async ({
  page,
}) => {
  const prompts = await serverModel(page, true);
  await household(page);
  await engineSays(page, "shell.model_server");
  await tellNeed({ page, lang: en }, need);
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts.join("\n")).not.toContain(BUDGET);
  await open(page, "nav.privacy");
  const section = page.getByRole("region", { name: t(en, "page.privacy_model_title") });
  await expect(section).toContainText(t(en, "page.privacy_model_about"));
  await shoot("privacy", { household: page }, FOLDER);
});

test("without a model on the API, nothing is sent and the phone answers by rules, unnamed", async ({ page }) => {
  const prompts = await serverModel(page, false);
  await household(page);
  await engineSays(page, undefined);
  await tellNeed({ page, lang: en }, need);
  expect(prompts).toEqual([]);
});
