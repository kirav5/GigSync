import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { greeting, newPhone, open, Role, RUN, signIn, textOf } from "./helpers.js";

/**
 * No generative model on the phone, on any platform: the web app offers none to download, as the Android and iPhone
 * apps never did (2026-11-15). A fresh worker and a fresh household see no download card or progress line in Talk,
 * Home or Find, and nothing about a model to keep in Settings. The understanding pack (ADR 0042, 0065) still comes by
 * itself, with no button; Find still reads what the household types.
 */

const { en } = Lang.enum;
const DOWNLOAD = /download/i;
/** The words the old offer card led with ("download about 1050 MB to this phone"). */
const MEGABYTES = /\d+\s*MB/;

async function nothingOffered(page: Page) {
  await expect(page.getByRole("button", { name: DOWNLOAD })).toHaveCount(0);
  await expect(page.getByText(DOWNLOAD)).toHaveCount(0);
  await expect(page.getByText(MEGABYTES)).toHaveCount(0);
  await expect(page.locator("progress")).toHaveCount(0);
}

test("a worker is offered no model in Talk or Settings", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Leela ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await nothingOffered(page);
  await open(page, "nav.settings");
  await nothingOffered(page);
});

test("a household is offered no model on Home, Find or Settings, and Find still reads", async ({ page }) => {
  await signIn(page, { role: Role.consumer, name: `Lata ${RUN}`, phone: newPhone(), address: "Jayanagar", lang: en });
  await nothingOffered(page);
  await open(page, "nav.find");
  const log = page.getByRole("log");
  await expect(greeting(page, en)).toBeVisible();
  await nothingOffered(page);
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill("I need a cook");
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
  await expect(log.getByText("I need a cook")).toBeVisible();
  await expect(log.getByText(textOf(en, "need.ask.trade"))).toHaveCount(0);
  await open(page, "nav.settings");
  await nothingOffered(page);
});
