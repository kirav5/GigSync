import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, Role, RUN, shoot, signIn, textOf } from "./helpers.js";

/**
 * Talk asks when the phone's model cannot tell what a note means (ADR 0042 amendment 2026-11-03): the agent shows it is
 * thinking while the model reads, then asks with one choice per meaning; a choice, or words typed in reply that name
 * one, answers the note first written. Walked with the dev build's fake engine (model-fake.ts), scripted to be unsure.
 */

const { en } = Lang.enum;
const FOLDER = "clarify";
const FAKE_MODEL_KEY = "gigsync-fake-model";
const READY_KEY = "gigsync-fake-model-ready";
const RECORD_KEY = "CapacitorStorage.settings:model_device";
const MODEL_ID = "Qwen3.5-2B-q4f16_1-MLC";
const DONE = JSON.stringify({ offer: "download", readySaid: true });
/** Long enough to see the agent thinking, short enough to stay under the router's limit. */
const ROUTING_MS = 1500;
const BOOKING = "I have a booking from 2-3PM tomorrow";
const SHARMA = "Sharma ji at 10 tomorrow";
const SAVE_IT = "save it";
const ROUTES = {
  [BOOKING]: JSON.stringify({ intent: "clarify", options: ["remember", "find"] }),
  [SHARMA]: JSON.stringify({ intent: "clarify", options: ["remember", "askSelf"] }),
  [SAVE_IT]: JSON.stringify({ intent: "remember", note: SAVE_IT }),
};

/** A phone whose model is downloaded and ready, and unsure about the messages above. */
async function phone(page: Page) {
  await page.addInitScript(
    ({ key, script, seed }) => {
      localStorage.setItem(key, JSON.stringify(script));
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    },
    {
      key: FAKE_MODEL_KEY,
      script: { mode: "capable", routes: ROUTES, delayMs: ROUTING_MS },
      seed: { [READY_KEY]: MODEL_ID, [RECORD_KEY]: DONE },
    },
  );
}

async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  await box.getByPlaceholder(t(en, "agent.placeholder")).fill(words);
  await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
}

const log = (page: Page) => page.getByRole("log");
const choice = (page: Page, key: Parameters<typeof t>[1]) =>
  log(page).getByRole("button", { name: t(en, key), exact: true });

test("the agent asks which a note means, shows it is thinking, and acts on the choice", async ({ page }) => {
  await phone(page);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();

  // While the model reads the note, the agent shows it is thinking.
  await say(page, BOOKING);
  const thinking = log(page)
    .getByRole("status")
    .filter({ hasText: t(en, "agent.thinking") });
  await expect(thinking).toBeVisible();
  await shoot("thinking", { worker: page }, FOLDER);

  // Unsure, it asks: one choice per meaning, and Something else.
  await expect(log(page)).toContainText(t(en, "agent.clarify"));
  await expect(thinking).toBeHidden();
  for (const key of ["choose.remember", "choose.find", "choose.chat"] as const)
    await expect(choice(page, key)).toBeVisible();
  await shoot("asked", { worker: page }, FOLDER);

  // "Save this as a note" keeps the words first written, whole.
  await choice(page, "choose.remember").click();
  await expect(log(page)).toContainText(t(en, "agent.saved", { text: BOOKING }));
  await expect(choice(page, "choose.find")).toBeHidden();

  // Asked again, words typed in reply that name a choice answer it, for the note first written.
  await say(page, SHARMA);
  await expect(choice(page, "choose.askSelf")).toBeVisible();
  await say(page, SAVE_IT);
  await expect(log(page)).toContainText(t(en, "agent.saved", { text: SHARMA }));
  await expect(choice(page, "choose.askSelf")).toBeHidden();
  await shoot("answered", { worker: page }, FOLDER);
});
