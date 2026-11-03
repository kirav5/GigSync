import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";

/**
 * A smoke test of the real web engine: WebLLM downloads Qwen3.5-2B (about 1 GB from Hugging Face) and
 * answers a routing prompt on this computer's GPU. Not part of the suite: run with REAL_MODEL=1 on a machine whose
 * headless Chromium has WebGPU (a Mac does); it skips itself where the browser offers no adapter.
 */

const { en } = Lang.enum;
const FOLDER = "on-device-real";
const FAKE_MODEL_KEY = "gigsync-fake-model";
const DOWNLOAD_MS = 600_000;
const QUESTION = "is ₹8,000 fair for a cook?";
const ROUTED = "chat routed";
const BY_MODEL = "model";
/** A first answer loads the model onto the GPU, which takes far longer than any later one. */
const ANSWER_MS = 120_000;

test.skip(!process.env.REAL_MODEL, "downloads 1 GB; run with REAL_MODEL=1");
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for a smoke test");

const hasAdapter = (page: Page) =>
  page.evaluate(async () =>
    Boolean(await (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()),
  );

test("the real model downloads, loads and answers on this GPU", async ({ page }) => {
  test.setTimeout(DOWNLOAD_MS * 2);
  await page.addInitScript((key) => localStorage.removeItem(key), FAKE_MODEL_KEY);
  await signIn(page, { role: Role.worker, name: `Real ${RUN}`, phone: newPhone(), lang: en });
  test.skip(!(await hasAdapter(page)), "no WebGPU adapter in this headless browser");

  const offer = page.getByRole("region", { name: t(en, "model.title") });
  await offer.getByRole("button", { name: t(en, "model.offer_download"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: textOf(en, "model.downloading") })).toBeVisible();
  await expect(page.getByText(t(en, "model.ready_line"))).toBeVisible({ timeout: DOWNLOAD_MS });
  await shoot("ready", { worker: page }, FOLDER);

  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();
  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  // The chat's log says who named the message's intent: the model itself, as proof it answered.
  const routed = page.waitForEvent("console", {
    predicate: async (m) =>
      m.text().includes(ROUTED) &&
      (
        await m
          .args()[1]
          ?.jsonValue()
          .catch(() => undefined)
      )?.via === BY_MODEL,
    timeout: ANSWER_MS,
  });
  const sent = Date.now();
  await box.getByPlaceholder(t(en, "agent.placeholder")).fill(QUESTION);
  await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
  await expect(page.getByRole("log").getByText(QUESTION)).toBeVisible();
  await routed;
  console.log(`routed by the model in ${Date.now() - sent} ms`);
  await shoot("answered", { worker: page }, FOLDER);
  await open(page, "nav.settings");
  await expect(page.getByRole("region", { name: t(en, "model.title") })).toContainText(t(en, "model.state_ready"));
  await shoot("settings", { worker: page }, FOLDER);
});
