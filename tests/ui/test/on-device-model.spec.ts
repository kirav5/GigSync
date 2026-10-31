import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn, textOf, toChat } from "./helpers.js";

/**
 * The phone's own model in the web app (ADR 0040, LLD §9.1), walked with the dev build's fake engine
 * (apps/mobile/src/adapters/model-fake.ts): headless browsers' GPUs say nothing about a phone's. A capable phone is
 * offered the download once in the chat; "Later" puts it away for good; "Download" shows progress in the chat, then
 * one line when it is ready; Settings removes it. On mobile data the offer says so and a stopped download never
 * carries on by itself; on Wi-Fi it does. A phone that cannot run it is never offered it. Too slow, and Auto stops.
 */

const { en } = Lang.enum;
const FOLDER = "on-device-model";
const FAKE_MODEL_KEY = "gigsync-fake-model";
const FETCHES_KEY = "gigsync-fake-model-fetches";
const PROGRESS_KEY = "gigsync-fake-model-progress";
const READY_KEY = "gigsync-fake-model-ready";
/** The app's record of the model on this phone, where Capacitor's web storage keeps it (model-device.ts). */
const RECORD_KEY = "CapacitorStorage.settings:model_device";
const Mode = { capable: "capable", incapable: "incapable", slow: "slow" } as const;
type Mode = (typeof Mode)[keyof typeof Mode];
/** Half of the fake's download had arrived before the page went away. */
const HALF_DOWN = "5";
/** Long enough for a download that would start by itself to have started. */
const SETTLE_MS = 1500;
/** The 0.8B's download, as the catalog in plugins/gigsync-llm/src/catalog.ts gives it. */
const SMALL_MB = 440;
const SLOW_ANSWERS = 3;
/** A share of the download between 30% and 70%. */
const PART_WAY = /[3-6]0%/;

/** This phone's fake engine, from the first page on; anything else in `seed` goes into localStorage once. */
async function phone(page: Page, mode: Mode, seed: Record<string, string> = {}) {
  await page.addInitScript(
    ({ key, mode, seed }) => {
      localStorage.setItem(key, JSON.stringify({ mode }));
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    },
    { key: FAKE_MODEL_KEY, mode, seed },
  );
}

/** What the browser says about the connection, as Chrome on Android does; Safari says nothing. */
async function connection(page: Page, type: string) {
  await page.addInitScript((type) => {
    Object.defineProperty(navigator, "connection", { value: { type, saveData: false }, configurable: true });
  }, type);
}

const offer = (page: Page) => page.getByRole("region", { name: t(en, "model.title") }).first();
const settingsCard = (page: Page) => page.getByRole("region", { name: t(en, "model.title") });
const fetches = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), FETCHES_KEY);

async function worker(page: Page, name: string) {
  await signIn(page, { role: Role.worker, name: `${name} ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
}

test("a capable phone is offered the model once, and Later puts it away", async ({ page }) => {
  await phone(page, Mode.capable);
  await worker(page, "Leela");
  await expect(offer(page)).toContainText(t(en, "model.offer", { mb: SMALL_MB }));
  await expect(offer(page)).toContainText(t(en, "model.private"));
  await shoot("offer", { worker: page }, FOLDER);

  await offer(page)
    .getByRole("button", { name: t(en, "model.offer_later"), exact: true })
    .click();
  await expect(page.getByText(t(en, "model.offer", { mb: SMALL_MB }))).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await expect(page.getByText(t(en, "model.offer", { mb: SMALL_MB }))).toHaveCount(0);
  expect(await fetches(page)).toEqual([]);

  // Settings still has it, a tap away.
  await open(page, "nav.settings");
  await expect(settingsCard(page)).toContainText(t(en, "model.state_downloadable"));
  await expect(
    settingsCard(page).getByRole("button", { name: t(en, "model.download", { mb: SMALL_MB }) }),
  ).toBeVisible();
});

test("Download shows progress in the chat, says once that it is ready, and Settings removes it", async ({ page }) => {
  await phone(page, Mode.capable);
  await worker(page, "Kaveri");
  await offer(page)
    .getByRole("button", { name: t(en, "model.offer_download"), exact: true })
    .click();
  const line = page.getByRole("status").filter({ hasText: textOf(en, "model.downloading") });
  await expect(line).toBeVisible();
  // Part-way, so the picture shows the bar moving.
  await expect(line).toContainText(PART_WAY);
  await shoot("downloading", { worker: page }, FOLDER);

  const ready = page.getByText(t(en, "model.ready_line"));
  await expect(ready).toBeVisible();
  await expect(line).toHaveCount(0);
  await shoot("ready", { worker: page }, FOLDER);
  // Said once: not again after a reload.
  await page.reload();
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await expect(ready).toHaveCount(0);

  await open(page, "nav.settings");
  const card = settingsCard(page);
  await expect(card).toContainText(t(en, "model.state_ready"));
  await expect(card).toContainText("Qwen3.5-0.8B");
  await shoot("settings-ready", { worker: page }, FOLDER);
  await card.getByRole("button", { name: t(en, "model.remove"), exact: true }).click();
  await expect(card).toContainText(t(en, "model.state_downloadable"));
  expect(await page.evaluate((k) => localStorage.getItem(k), READY_KEY)).toBeNull();
  await shoot("settings-removed", { worker: page }, FOLDER);
});

test("on mobile data the offer says so, and a stopped download never carries on by itself", async ({ page }) => {
  await connection(page, "cellular");
  await phone(page, Mode.capable);
  await worker(page, "Tara");
  await expect(offer(page)).toContainText(t(en, "model.mobile_data", { mb: SMALL_MB }));
  await shoot("offer-mobile-data", { worker: page }, FOLDER);

  // A download agreed to earlier stopped half-way; the app opens again on mobile data.
  const stopped = JSON.stringify({ offer: "download", wanted: true, speed: { times: [], verdict: "measuring" } });
  await page.evaluate(
    ([k, v, p, half]) => {
      localStorage.setItem(k, v);
      localStorage.setItem(p, half);
    },
    [RECORD_KEY, stopped, PROGRESS_KEY, HALF_DOWN] as const,
  );
  await page.reload();
  await expect(offer(page)).toContainText(t(en, "model.paused"));
  await expect(offer(page)).toContainText(t(en, "model.mobile_data", { mb: SMALL_MB }));
  await page.waitForTimeout(SETTLE_MS);
  expect(await fetches(page)).toEqual([]);
  await shoot("paused-mobile-data", { worker: page }, FOLDER);

  // Only the owner's tap resumes it, from where it stopped.
  await offer(page)
    .getByRole("button", { name: t(en, "model.resume"), exact: true })
    .click();
  await expect(page.getByText(t(en, "model.ready_line"))).toBeVisible();
  expect(await fetches(page)).toHaveLength(1);
});

test("on Wi-Fi a stopped download carries on by itself", async ({ page }) => {
  await connection(page, "wifi");
  const stopped = JSON.stringify({ offer: "download", wanted: true, speed: { times: [], verdict: "measuring" } });
  await phone(page, Mode.capable, { [RECORD_KEY]: stopped, [PROGRESS_KEY]: HALF_DOWN });
  await worker(page, "Gowri");
  await expect(page.getByText(t(en, "model.ready_line"))).toBeVisible();
  expect(await fetches(page)).toHaveLength(1);
});

test("a phone that cannot run the model is never offered it, and Settings says why", async ({ page }) => {
  await phone(page, Mode.incapable);
  await worker(page, "Usha");
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.getByText(t(en, "model.offer", { mb: SMALL_MB }))).toHaveCount(0);
  await open(page, "nav.settings");
  await expect(settingsCard(page)).toContainText(t(en, "model.why.no_webgpu"));
  await expect(settingsCard(page).getByRole("button", { name: t(en, "model.download", { mb: SMALL_MB }) })).toHaveCount(
    0,
  );
  await shoot("settings-incapable", { worker: page }, FOLDER);
});

test("too slow on this phone, Auto stops using the model until Try again", async ({ page }) => {
  const done = JSON.stringify({ offer: "download", readySaid: true, speed: { times: [], verdict: "measuring" } });
  await phone(page, Mode.slow, { [READY_KEY]: "Qwen3.5-0.8B-q4f16_1-MLC", [RECORD_KEY]: done });
  await worker(page, "Bhavya");
  await page.getByRole("button", { name: t(en, "iv.later"), exact: true }).click();
  const box = page.getByRole("form", { name: t(en, "nav.talk") });
  for (let i = 0; i < SLOW_ANSWERS; i++) {
    await box.getByPlaceholder(t(en, "agent.placeholder")).fill(`remember note ${i}`);
    await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
    await expect(page.getByRole("log").getByText(`remember note ${i}`)).toBeVisible();
  }
  await open(page, "nav.settings");
  const card = settingsCard(page);
  await expect(card).toContainText(t(en, "model.slow"));
  await expect(card).toContainText(
    t(en, "model.now", { model: t(en, "model.auto_label", { model: t(en, "model.lite_label") }) }),
  );
  await shoot("settings-slow", { worker: page }, FOLDER);
  await card.getByRole("button", { name: t(en, "model.try_again"), exact: true }).click();
  await expect(card).not.toContainText(t(en, "model.slow"));
  await toChat(page);
});
