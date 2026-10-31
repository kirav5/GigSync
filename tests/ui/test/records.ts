import { HttpMethod, RecordsAnswer } from "@gigsync/core";
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
