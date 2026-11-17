import { t } from "@gigsync/core";
import { DEFAULT_LANG } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import {
  DEV_KEY_STORAGE,
  ekycZip,
  lockedPdf,
  SHARE_CODE,
  secureQrText,
  type TestUidai,
  testUidai,
} from "./aadhaar-files.js";
import { DEV_OTP, newPhone, openProfile, profileSheet, Role, RUN, SHOTS, signIn } from "./helpers.js";

/**
 * Get verified binds the Aadhaar to the person holding the phone: after UIDAI's signature checks out, the mobile
 * linked to the Aadhaar must be the signed-in number, or another the person proves with GigSync's own SMS code. The
 * files here are signed with a test key the dev build trusts (aadhaar-files.ts); the dev API's code is 000000.
 */

const lang = DEFAULT_LANG;
const ZIP = "offlineaadhaar20261116000000000.zip";
const PDF = "EAadhaar_0000111122223333_16112026.pdf";
const PDF_PASSWORD = "LAKS1990";

let uidai: TestUidai;

test.beforeAll(async () => {
  uidai = await testUidai();
});

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}bind/${name}.png` });

/** Signs a new person in with the test key trusted, and opens Get verified. */
async function openGetVerified(page: Page, phone: string) {
  await page.addInitScript(([key, spki]) => localStorage.setItem(key, spki), [DEV_KEY_STORAGE, uidai.spki] as const);
  await signIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone, lang });
  await openProfile(page, lang);
  await profileSheet(page, lang)
    .getByRole("button", { name: t(lang, "idcheck.title") })
    .click();
}

/** Picks an e-KYC ZIP and checks it with the share code. */
async function checkZip(page: Page, zip: Buffer) {
  await page.getByRole("button", { name: t(lang, "idcheck.ekyc"), exact: true }).click();
  const sheet = page.getByRole("dialog", { name: t(lang, "idcheck.ekyc_title") });
  await sheet.locator("input[type=file]").setInputFiles({ name: ZIP, mimeType: "application/zip", buffer: zip });
  await sheet.getByLabel(t(lang, "idcheck.ekyc_code")).fill(SHARE_CODE);
  await sheet.getByRole("button", { name: t(lang, "idcheck.ekyc_check"), exact: true }).click();
}

async function sayYes(page: Page) {
  await expect(page.getByRole("heading", { name: t(lang, "idcheck.confirm_title") })).toBeVisible();
  await page.getByRole("button", { name: t(lang, "idcheck.confirm_yes") }).click();
  await expect(page.getByRole("heading", { name: t(lang, "idcheck.verified_title") })).toBeVisible();
}

test("an e-KYC file linked to the signed-in number goes straight to is this you", async ({ page }) => {
  const phone = newPhone();
  await openGetVerified(page, phone);
  await shot(page, "01-intro");
  await checkZip(page, await ekycZip(uidai, phone));
  await shot(page, "02-confirm");
  await sayYes(page);
  await shot(page, "03-verified");
});

test("an e-KYC file linked to another number is bound by that number's SMS code", async ({ page }) => {
  const second = newPhone();
  await openGetVerified(page, newPhone());
  await checkZip(page, await ekycZip(uidai, second));

  const other = page.getByRole("form", { name: t(lang, "idcheck.other_title") });
  await expect(other).toBeVisible();
  const field = other.getByLabel(t(lang, "idcheck.other_number"));
  const send = other.getByRole("button", { name: t(lang, "idcheck.other_send") });
  await field.fill("9811000000");
  await send.click();
  await expect(other.getByRole("alert")).toHaveText(t(lang, "idcheck.other_wrong", { left: 2 }));
  await shot(page, "04-other-wrong");

  await field.fill(second.slice(3));
  await shot(page, "05-other-number");
  await send.click();
  await expect(page.getByRole("heading", { name: t(lang, "idcheck.other_code_title") })).toBeVisible();
  await shot(page, "06-other-code");
  await page.getByLabel(t(lang, "signin.code")).fill(DEV_OTP);
  await sayYes(page);
});

test("a wrong number three times stops the check for the day", async ({ page }) => {
  await openGetVerified(page, newPhone());
  await checkZip(page, await ekycZip(uidai, newPhone()));
  const other = page.getByRole("form", { name: t(lang, "idcheck.other_title") });
  for (const left of [2, 1]) {
    await other.getByLabel(t(lang, "idcheck.other_number")).fill("9811000000");
    await other.getByRole("button", { name: t(lang, "idcheck.other_send") }).click();
    await expect(other.getByRole("alert")).toHaveText(t(lang, "idcheck.other_wrong", { left }));
  }
  await other.getByRole("button", { name: t(lang, "idcheck.other_send") }).click();
  await expect(other.getByRole("alert")).toHaveText(t(lang, "idcheck.other_stop"));
  await expect(other.getByLabel(t(lang, "idcheck.other_number"))).toBeDisabled();
  await shot(page, "07-other-stop");
});

test("an Aadhaar with no mobile linked gets no badge", async ({ page }) => {
  await openGetVerified(page, newPhone());
  await checkZip(page, await ekycZip(uidai, undefined));
  await expect(page.getByRole("heading", { name: t(lang, "idcheck.not_linked_title") })).toBeVisible();
  await expect(page.getByText(t(lang, "idcheck.not_linked"))).toBeVisible();
  await shot(page, "08-not-linked");
});

test("an e-Aadhaar PDF: a wrong password is said plainly, the right one reads its QR", async ({ page }) => {
  const phone = newPhone();
  await openGetVerified(page, phone);
  await page.getByRole("button", { name: t(lang, "idcheck.where") }).click();
  const where = page.getByRole("dialog", { name: t(lang, "idcheck.where_title") });
  await expect(where.getByText(t(lang, "idcheck.where_pdf"))).toBeVisible();
  await shot(page, "09-where");
  await where.getByRole("button", { name: t(lang, "idcheck.where_ok") }).click();

  await page.getByRole("button", { name: t(lang, "idcheck.pdf"), exact: true }).click();
  const sheet = page.getByRole("dialog", { name: t(lang, "idcheck.pdf_title") });
  const pdf = lockedPdf(await secureQrText(uidai, phone), PDF_PASSWORD);
  await sheet.locator("input[type=file]").setInputFiles({ name: PDF, mimeType: "application/pdf", buffer: pdf });
  const password = sheet.getByLabel(t(lang, "idcheck.pdf_password"));
  const check = sheet.getByRole("button", { name: t(lang, "idcheck.ekyc_check"), exact: true });
  await password.fill("LAKS1991");
  await check.click();
  await expect(sheet.getByRole("alert")).toHaveText(t(lang, "idcheck.pdf_wrong_password"));
  await shot(page, "10-pdf-wrong-password");

  await password.fill(PDF_PASSWORD);
  await check.click();
  // A V2 card prints the mobile's last 4 digits: they match the signed-in number.
  await sayYes(page);
  await shot(page, "11-pdf-verified");
});
