import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, Role, RUN, shoot, signIn, textOf } from "./helpers.js";

/**
 * Talk asks when the model cannot tell what a note means (ADR 0042 amendment 2026-11-03): the agent shows it is
 * thinking while the model reads, then asks with one choice per meaning; a choice, or words typed in reply that name
 * one, answers the note first written. The model is a fake standing in for Ollama, the dev build's local model (as in
 * model-route.spec.ts), scripted to be unsure.
 */

const { en } = Lang.enum;
const FOLDER = "clarify";
const OLLAMA_GENERATE = "http://localhost:11434/api/generate";
/** The Settings choice that sends every model call to Ollama, kept where the app keeps it. */
const MODEL_SETTING = { key: "CapacitorStorage.settings:model", value: { choice: "ollama", ollamaModel: "fake" } };
/** The line a routing prompt ends with (packages/core/src/router/model-prompt.ts), the message as JSON after it. */
const MESSAGE_LINE = "Message: ";
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

/** The scripted reply for the message a routing prompt ends with, or empty for anything else. */
function routeReply(prompt: string): string {
  const line = prompt
    .split("\n")
    .reverse()
    .find((l) => l.startsWith(MESSAGE_LINE));
  if (!line) return "";
  const said: unknown = JSON.parse(line.slice(MESSAGE_LINE.length));
  return typeof said === "string" ? (ROUTES[said as keyof typeof ROUTES] ?? "") : "";
}

/** A phone whose model answers slowly, and is unsure about the messages above. */
async function phone(page: Page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), MODEL_SETTING);
  await page.route(OLLAMA_GENERATE, async (route) => {
    const { prompt } = route.request().postDataJSON() as { prompt: string };
    const response = routeReply(prompt);
    if (response) await new Promise((done) => setTimeout(done, ROUTING_MS));
    await route.fulfill({ json: { response }, headers: { "access-control-allow-origin": "*" } });
  });
}

async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  await box.getByPlaceholder(t(en, "composer.ask")).fill(words);
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
