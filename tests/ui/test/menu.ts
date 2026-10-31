import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";

/**
 * The app's frame as the specs reach it, as the collab app's: a menu (a drawer behind ☰ on a phone, a column beside the
 * content on a wide screen) with six screens, the chat as home, × back to it, and sign-out in the menu's foot.
 */

/** The menu (collab's sidebar), named in the owner's language: a drawer on a phone, beside the content when wide. */
export const drawer = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("navigation", { name: t(lang, "shell.drawer") });

/** The top bar's menu button, which opens the drawer; a wide screen has none. */
export const menuButton = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("button", { name: t(lang, "shell.menu"), exact: true });

/**
 * The signed-in frame, whatever the width: the menu button on a phone (its drawer closed, so hidden), the menu itself
 * on a wide screen. Exactly one of the two is in the accessibility tree at a time.
 */
export const shell = (page: Page, lang: Lang = DEFAULT_LANG) => menuButton(page, lang).or(drawer(page, lang));

/** My jobs, a household's old tab, as some specs still name it: Activity took its place. */
const MOVED: Partial<Record<MessageKey, MessageKey>> = { "nav.my_jobs": "nav.activity" };
/** The tabs that were the chat, which is home now: Talk for a worker, Find for a household. */
const CHAT: ReadonlySet<MessageKey> = new Set(["nav.talk", "nav.find"]);

/** Opens the menu, unless it is open or stands beside the content (a wide screen), backing out of a sub-screen first. */
export async function openDrawer(page: Page, lang: Lang = DEFAULT_LANG) {
  // A screen opened from inside another has Back where ☰ was, as collab's detail panel does: back out of it first.
  const back = page.getByRole("banner").getByRole("button", { name: t(lang, "a11y.back"), exact: true });
  while (await back.isVisible()) await back.click();
  // The frame first: right after a reload the app has not drawn yet, and no menu button would mean "wide".
  await expect(shell(page, lang).first()).toBeVisible();
  const menu = menuButton(page, lang);
  if ((await menu.count()) > 0 && (await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
  await expect(drawer(page, lang)).toBeVisible();
}

/** Back to the chat from any other screen, with the top bar's ×; nothing to do on the chat itself. */
export async function toChat(page: Page, lang: Lang = DEFAULT_LANG) {
  // The top bar first: right after a reload the app has not drawn yet, and no × would mean "on the chat".
  await expect(page.getByRole("banner")).toBeVisible();
  const close = page.getByRole("button", { name: t(lang, "shell.to_chat"), exact: true });
  if ((await close.count()) > 0) await close.click();
  await expect(close).toHaveCount(0);
}

/**
 * A row of the menu by its name in the person's language (a count or a dot is the row's description, so the name is
 * exact), found even while the drawer is closed, to read which screen is open. Old tab names find their new row.
 */
export const navRow = (page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) =>
  page
    .getByRole("navigation", { name: t(lang, "shell.drawer"), includeHidden: true })
    .getByRole("button", { name: t(lang, MOVED[screen] ?? screen), exact: true, includeHidden: true });

/** Expects `screen` to be the one showing: its menu row marked, or, for the chat, no × back to it. */
export async function onScreen(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (CHAT.has(screen)) {
    await expect(page.getByRole("button", { name: t(lang, "shell.to_chat"), exact: true })).toHaveCount(0);
    return;
  }
  await expect(navRow(page, screen, lang)).toHaveAttribute("aria-current", "page");
}

/**
 * Opens a screen through the menu, by its row's name. The old tab names still work: My jobs opens Activity, and Talk
 * or Find go back to the chat.
 */
export async function open(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (CHAT.has(screen)) return toChat(page, lang);
  await openDrawer(page, lang);
  await navRow(page, screen, lang).click();
  await onScreen(page, screen, lang);
}

/** Signs out from the menu's foot. */
export async function signOutHere(page: Page, lang: Lang = DEFAULT_LANG) {
  await openDrawer(page, lang);
  await drawer(page, lang)
    .getByRole("button", { name: t(lang, "shell.sign_out"), exact: true })
    .click();
}

/** My card's form, from the menu: My card, then Edit my card. */
export async function openCard(page: Page, lang: Lang = DEFAULT_LANG) {
  await open(page, "nav.card", lang);
  await page.getByRole("button", { name: t(lang, "shell.edit_card"), exact: true }).click();
  await expect(page.getByRole("form", { name: t(lang, "a11y.my_card") })).toBeVisible();
}
