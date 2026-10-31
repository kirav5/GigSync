import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { APP, drawer, newPhone, onScreen, open, openCard, openDrawer, Role, RUN, signIn } from "./helpers.js";

/**
 * Back in the web app, and in the installed one, stays inside GigSync the way Android's button does in the native
 * app: an open menu closes first, My card's form goes back to My card, any other screen to the chat, and only from
 * there does Back leave. Screens are not pages, so without this Back would leave from anywhere, and an installed app
 * on Android would close.
 */

const { en } = Lang.enum;

test("Back walks a worker from My card's form to My card to the chat, and only then leaves", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Kamala ${RUN}`, phone: newPhone() });
  // The chat is home: Talk, where she makes her card by talking.
  await onScreen(page, "nav.talk");
  await openCard(page);
  await page.goBack();
  await onScreen(page, "nav.card");
  await expect(page.getByRole("form", { name: t(en, "a11y.my_card") })).toHaveCount(0);
  await page.goBack();
  await onScreen(page, "nav.talk");
  expect(page.url().startsWith(APP)).toBe(true);
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});

test("Back closes the open menu first, and going back to the chat with × leaves nothing for Back to undo", async ({
  page,
}) => {
  await signIn(page, { role: Role.worker, name: `Lata ${RUN}`, phone: newPhone() });
  await openDrawer(page);
  await page.goBack();
  await expect(drawer(page)).toBeHidden();
  expect(page.url().startsWith(APP)).toBe(true);
  await open(page, "nav.records");
  await open(page, "nav.talk");
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});
