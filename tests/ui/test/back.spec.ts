import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { APP, chatList, newPhone, onScreen, open, openCard, Role, RUN, showChats, signIn } from "./helpers.js";

/**
 * Back in the web app, and in the installed one, stays inside GigSync the way Android's button does in the native
 * app: one screen at a time, the way the owner came (My card's form to My card, to the chat the profile sheet was opened over), and only from the
 * first screen does Back leave. Screens are not pages, so without this Back would leave from anywhere, and an
 * installed app on Android would close.
 */

const { en } = Lang.enum;

test("Back walks a worker from My card's form to My card, to the chat she opened it from, and only then leaves", async ({
  page,
}) => {
  await signIn(page, { role: Role.worker, name: `Kamala ${RUN}`, phone: newPhone() });
  // The chat is home: Talk, where she makes her card by talking.
  await onScreen(page, "nav.talk");
  await openCard(page);
  await page.goBack();
  await onScreen(page, "nav.card");
  await expect(page.getByRole("form", { name: t(en, "a11y.my_card") })).toHaveCount(0);
  // My card opened from the profile sheet over Talk, so Back comes to Talk.
  await page.goBack();
  await onScreen(page, "nav.talk");
  expect(page.url().startsWith(APP)).toBe(true);
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});

test("Back closes the chats screen first, and a tab's screen goes back to the one before", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Lata ${RUN}`, phone: newPhone() });
  await showChats(page);
  await page.goBack();
  await expect(chatList(page)).toBeHidden();
  await onScreen(page, "nav.talk");
  expect(page.url().startsWith(APP)).toBe(true);
  await open(page, "nav.records");
  await page.goBack();
  await onScreen(page, "nav.talk");
  await page.goBack();
  expect(page.url().startsWith(APP)).toBe(false);
});
