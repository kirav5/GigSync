import { readFileSync } from "node:fs";
import { t } from "@gigsync/core";
import { DEFAULT_LANG } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { newPhone, openProfile, profileSheet, Role, RUN, signIn } from "./helpers.js";

/**
 * Get verified with UIDAI's Paperless Offline e-KYC file: the quiet third option on the intro opens a sheet with
 * UIDAI's steps, the myAadhaar link, a ZIP picker and the share code. No real UIDAI-signed file can live in the repo,
 * so this walks the refusals: a file that is not a ZIP, a real share-code ZIP (Info-ZIP's ZipCrypto, from core's
 * fixtures) opened with the wrong code, then with the right one, where its XML carries no UIDAI signature.
 */

const lang = DEFAULT_LANG;
const CODE = "Ab3x";
const fixture = (name: string) =>
  readFileSync(new URL(`../../../packages/core/test/fixtures/${name}`, import.meta.url));
const ZIP_NAME = "offlineaadhaar20261116000000000.zip";

test("the e-KYC sheet checks a ZIP and its share code on the phone, and says what is wrong", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Kavya ${RUN}`, phone: newPhone(), lang });
  await openProfile(page, lang);
  await profileSheet(page, lang)
    .getByRole("button", { name: t(lang, "idcheck.title") })
    .click();
  await page.getByRole("button", { name: t(lang, "idcheck.ekyc"), exact: true }).click();

  const sheet = page.getByRole("dialog", { name: t(lang, "idcheck.ekyc_title") });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(t(lang, "idcheck.ekyc_step1"))).toBeVisible();
  await expect(sheet.getByRole("link", { name: t(lang, "idcheck.ekyc_open") })).toHaveAttribute(
    "href",
    "https://myaadhaar.uidai.gov.in/offline-ekyc",
  );
  const check = sheet.getByRole("button", { name: t(lang, "idcheck.ekyc_check"), exact: true });
  await expect(check).toBeDisabled();

  const picker = sheet.locator("input[type=file]");
  const code = sheet.getByLabel(t(lang, "idcheck.ekyc_code"));
  const alert = sheet.getByRole("alert");

  await picker.setInputFiles({ name: "aadhaar.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
  await code.fill(CODE);
  await check.click();
  await expect(alert).toHaveText(t(lang, "idcheck.ekyc_not_file"));

  const zip = { name: ZIP_NAME, mimeType: "application/zip", buffer: fixture("ekyc-infozip-zipcrypto.zip") };
  await picker.setInputFiles(zip);
  await expect(sheet.getByText(t(lang, "idcheck.ekyc_file_chosen", { name: ZIP_NAME }))).toBeVisible();
  await code.fill("Ab3y");
  await check.click();
  await expect(alert).toHaveText(t(lang, "idcheck.ekyc_wrong_code"));

  await code.fill(CODE);
  await check.click();
  await expect(alert).toHaveText(t(lang, "idcheck.ekyc_bad_signature"));

  // Later closes the sheet and leaves the intro as it was: the scan stays the first way.
  await sheet.getByRole("button", { name: t(lang, "idcheck.later"), exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: t(lang, "idcheck.scan"), exact: true })).toBeVisible();
});
