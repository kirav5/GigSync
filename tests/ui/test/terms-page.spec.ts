import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { chooseLanguage, newPhone, shoot } from "./helpers.js";

/**
 * The Terms and Privacy Notice from the sign-in welcome: a full page with Back and its title, the date it last changed,
 * a contents list that jumps to its numbered sections, and no company name in the text. Back returns to the welcome,
 * and the number typed before is still there.
 */
const { en } = Lang.enum;
const FOLDER = "signin";
/** No company or brand name in the terms' text. */
const BRANDS = /gigsync|snabbit/i;

test("Terms opens over sign-in with Back, contents and numbered sections, and Back keeps what was typed", async ({
  page,
}) => {
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

  // The contents jump to a section; each section's heading carries its number.
  const contents = terms.getByRole("navigation", { name: t(en, "legal.contents") });
  await contents.getByRole("button", { name: `8. ${t(en, "legal.privacy")}` }).click();
  const privacy = terms.getByRole("heading", { level: 2, name: `8. ${t(en, "legal.privacy")}` });
  await expect(privacy).toBeInViewport();
  await shoot("terms-privacy", { phone: page }, FOLDER);
  expect(await terms.textContent()).not.toMatch(BRANDS);

  await terms.getByRole("button", { name: t(en, "a11y.back"), exact: true }).click();
  await expect(terms).toBeHidden();
  await welcome.click();
  await expect(number).toHaveValue(kept);
});
