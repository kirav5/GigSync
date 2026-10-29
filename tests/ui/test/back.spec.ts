import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { APP, newPhone, open, openCard, Role, RUN, signIn, tabs } from "./helpers.js";

/**
 * Back in the web app, and in the installed one, stays inside GigSync the way Android's button does in the native
 * app: My card goes back to Profile, any other tab to the landing one, and only from there does Back leave. Screens
 * are not pages, so without this Back would leave from anywhere, and an installed app on Android would close.
 */

const { en } = Lang.enum;

/** The tab showing now. */
const onTab = (page: Page, key: MessageKey) =>
  expect(tabs(page).getByRole("button", { name: t(en, key) })).toHaveAttribute("aria-current", "page");

test("Back walks a worker from My card to Profile to her landing tab, and only then leaves", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Kamala ${RUN}`, phone: newPhone() });
  // With no card yet, Talk is where she lands.
  await onTab(page, "nav.talk");
  await openCard(page);
  await page.goBack();
  await onTab(page, "nav.profile");
  await expect(page.getByRole("form", { name: t(en, "a11y.my_card") })).toHaveCount(0);
  await page.goBack();
  await onTab(page, "nav.talk");
  expect(page.url().startsWith(APP)).toBe(true);
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});

test("going back to the landing tab by tapping it leaves nothing for Back to undo first", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Lata ${RUN}`, phone: newPhone() });
  await open(page, "nav.passbook");
  await open(page, "nav.talk");
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});
