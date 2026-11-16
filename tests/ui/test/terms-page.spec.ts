import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { chooseLanguage, newPhone, shoot } from "./helpers.js";

/**
 * The Terms and Privacy Notice from the sign-in welcome: one white page with Back and its title, the date it last
 * changed, its numbered sections, and no company name in the text. Back returns to the welcome,
 * and the number typed before is still there.
 */
const { en } = Lang.enum;
const FOLDER = "signin";
/** No company or brand name in the terms' text. */
const BRANDS = /gigsync|snabbit/i;

test("Terms opens over sign-in with Back and numbered sections, and Back keeps what was typed", async ({ page }) => {
  await chooseLanguage(page, en);
  const form = page.getByRole("form", { name: t(en, "signin.label") });
  const welcome = page.getByRole("button", { name: t(en, "start.welcome_go"), exact: true });
  await welcome.click();
  const number = form.getByLabel(t(en, "signin.phone"));
  const typed = newPhone().slice(3);
  await number.fill(typed);
  const kept = await number.inputValue();
  await form.getByRole("button", { name: t(en, "a11y.back"), exact: true }).click();

  await page.getByRole("button", { name: t(en, "records.signin_link"), exact: true }).click();
  const terms = page.getByRole("region", { name: t(en, "records.terms_title") });
  await expect(terms.getByRole("heading", { level: 1, name: t(en, "records.terms_title") })).toBeVisible();
  await expect(terms).toContainText(t(en, "legal.updated", { date: "" }).trim());
  await shoot("terms-top", { phone: page }, FOLDER);

  // No contents list: the sections follow, each heading carrying its number.
  await expect(terms.getByRole("navigation")).toHaveCount(0);
  const privacy = terms.getByRole("heading", { level: 2, name: `8. ${t(en, "legal.privacy")}` });
  await privacy.scrollIntoViewIfNeeded();
  await expect(privacy).toBeInViewport();
  await shoot("terms-privacy", { phone: page }, FOLDER);
  expect(await terms.textContent()).not.toMatch(BRANDS);

  await terms.getByRole("button", { name: t(en, "a11y.back"), exact: true }).click();
  await expect(terms).toBeHidden();
  await welcome.click();
  await expect(number).toHaveValue(kept);
});
