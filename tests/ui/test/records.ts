import { readFileSync } from "node:fs";
import { HttpMethod, RecordsAnswer, t } from "@gigsync/core";
import { DEFAULT_LANG } from "@gigsync/protocol";
import { expect, type Page, type Response } from "@playwright/test";
import { API } from "./helpers.js";

/** The owner's stored answer, under any owner: the app writes it as `...owner_settings...:records_consent`. */
const ANSWER_KEY = /owner_settings.*:records_consent$/;
const CONSENT_PATH = "/v1/consent";
const ANSWER_MS = 60_000;

/** What this phone keeps as the owner's answer to the Terms and Privacy Notice, if anything (ADR 0039 §4). */
export async function storedAnswer(page: Page): Promise<string | undefined> {
  return page.evaluate((pattern) => {
    const key = Object.keys(localStorage).find((k) => new RegExp(pattern).test(k));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}") as { answer?: string }).answer : undefined;
  }, ANSWER_KEY.source);
}

/** Waits until the phone keeps the owner's agreement: the server took it first, so GigSync holds it too. */
export async function expectAgreed(page: Page) {
  await expect.poll(() => storedAnswer(page), { timeout: ANSWER_MS }).toBe(RecordsAnswer.agreed);
}

/** The next PUT /v1/consent that GigSync accepted. */
export const consentAccepted = (page: Page): Promise<Response> =>
  page.waitForResponse(
    (r) => r.url() === `${API}${CONSENT_PATH}` && r.request().method() === HttpMethod.put && r.ok(),
    { timeout: ANSWER_MS },
  );

/** Makes every call to the consent routes fail on this page, as an older app that never made them would. */
export const blockConsent = (page: Page) => page.route(`${API}${CONSENT_PATH}`, (route) => route.abort());
export const unblockConsent = (page: Page) => page.unroute(`${API}${CONSENT_PATH}`);

/** The work record file's name: the day it was made, and no person's name. */
const RECORD_FILE = /^gigsync-work-record-\d{4}-\d{2}-\d{2}\.csv$/;

/**
 * Records' "Download my work record", as an ordinary download (no share sheet on this page): the file's name and its
 * lines, the column headings first.
 */
export async function downloadRecord(page: Page): Promise<{ file: string; lines: string[] }> {
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: t(DEFAULT_LANG, "records.download_title"), exact: true }).click();
  const download = await saving;
  const file = download.suggestedFilename();
  expect(file).toMatch(RECORD_FILE);
  return {
    file,
    lines: readFileSync(await download.path(), "utf8")
      .trim()
      .split("\r\n"),
  };
}
