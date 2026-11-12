import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The app's frame as the specs reach it: four tabs at the foot of a tab's screen (a rail beside the content on a wide
 * screen), Back in the top bar on every screen opened from inside another, the Me tab's rows to the owner's pages,
 * and the chats on a screen of their own. Specs name screens by their old menu keys; each finds its way from here.
 */

/** The four tabs, named in the owner's language: at the foot of a tab's screen, or the rail on a wide screen. */
export const tabBar = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("navigation", { name: t(lang, "shell.tabs") });

/** The tabs each old menu key is reached by now. Records is Money for a worker and Pay for a household. */
const TABS: Partial<Record<MessageKey, readonly MessageKey[]>> = {
  "nav.activity": ["nav.jobs"],
  "nav.my_jobs": ["nav.jobs"],
  "nav.jobs": ["nav.jobs"],
  "nav.records": ["nav.money", "nav.pay"],
  "nav.money": ["nav.money"],
  "nav.pay": ["nav.pay"],
  "nav.find": ["nav.find"],
  "nav.home": ["nav.home"],
  "nav.me": ["nav.me"],
};
/** Talk, a worker's chat, opened from Home. */
const TALK: MessageKey = "nav.talk";

/** One tab by its name (an old menu key finds its new tab), counted or dotted or not: the name is exact. */
export function tab(page: Page, key: MessageKey, lang: Lang = DEFAULT_LANG): Locator {
  const [first, ...rest] = (TABS[key] ?? [key]).map((name) =>
    tabBar(page, lang).getByRole("button", { name: t(lang, name), exact: true }),
  );
  return rest.reduce((all, one) => all.or(one), first ?? tabBar(page, lang));
}

/** The top bar's Back. */
const back = (page: Page, lang: Lang) =>
  page.getByRole("banner").getByRole("button", { name: t(lang, "a11y.back"), exact: true });

/** The top bar's title. */
const title = (page: Page) => page.getByRole("banner").locator(".topbar-title");

/** Talk's composer: a worker is on their chat. */
const talkForm = (page: Page, lang: Lang) => page.getByRole("form", { name: t(lang, TALK) });

/** Back out of screens opened from inside others until the tabs show (a phone shows them on a tab's screen only). */
export async function backToTabs(page: Page, lang: Lang = DEFAULT_LANG) {
  // The frame first: right after a reload the app has not drawn yet.
  await expect(page.getByRole("banner")).toBeVisible();
  while (!(await tabBar(page, lang).isVisible()) && (await back(page, lang).isVisible()))
    await back(page, lang).click();
  await expect(tabBar(page, lang)).toBeVisible();
}

/** Talk: already on it, the chat a worker without a card lands on, or Home's way in. */
async function toTalk(page: Page, lang: Lang) {
  await expect(page.getByRole("banner")).toBeVisible();
  if (await talkForm(page, lang).isVisible()) return;
  await backToTabs(page, lang);
  if (await talkForm(page, lang).isVisible()) return;
  await tab(page, "nav.home", lang).click();
  await page.getByRole("button", { name: t(lang, "home.talk_agent"), exact: true }).click();
  await expect(talkForm(page, lang)).toBeVisible();
}

/** Back to the owner's chat from any screen: Find's tab for a household; Talk, from Home, for a worker. */
export async function toChat(page: Page, lang: Lang = DEFAULT_LANG) {
  await expect(page.getByRole("banner")).toBeVisible();
  if (await talkForm(page, lang).isVisible()) return;
  await backToTabs(page, lang);
  const find = tab(page, "nav.find", lang);
  if ((await find.count()) > 0) {
    await find.click();
    await expect(find).toHaveAttribute("aria-current", "page");
    return;
  }
  await toTalk(page, lang);
}

/** The chats kept on this phone, on their own screen. */
export const chatList = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("region", { name: t(lang, "chats.title") });

/** Opens the chats from the owner's chat: the top bar's chats button on Talk or Find. */
export async function showChats(page: Page, lang: Lang = DEFAULT_LANG) {
  await toChat(page, lang);
  await page
    .getByRole("banner")
    .getByRole("button", { name: t(lang, "chats.title"), exact: true })
    .click();
  await expect(chatList(page, lang)).toBeVisible();
}

/** New chat, from the chats screen: the open chat stays in the list and an empty one opens. */
export async function newChat(page: Page, lang: Lang = DEFAULT_LANG) {
  await showChats(page, lang);
  await page.getByRole("button", { name: t(lang, "chats.new"), exact: true }).click();
}

/**
 * A screen the old menu opened, by its key: a tab's button, or, for the owner's pages under Me, the Me row with that
 * exact name (a count, a dot or the line under a row is its description, never its name).
 */
export const navRow = (page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) =>
  TABS[screen] ? tab(page, screen, lang) : page.getByRole("button", { name: t(lang, screen), exact: true });

/** Expects `screen` to be the one showing: its tab marked, Talk's composer, or the screen's name in the top bar. */
export async function onScreen(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (screen === TALK) {
    await expect(talkForm(page, lang)).toBeVisible();
    return;
  }
  if (TABS[screen]) {
    await expect(tab(page, screen, lang)).toHaveAttribute("aria-current", "page");
    return;
  }
  await expect(title(page)).toHaveText(t(lang, screen));
}

/**
 * Opens a screen by its old menu key: the tab for Jobs (Activity, My jobs), Money or Pay (Records) and Find; Home and
 * then Talk for Talk; the Me tab and then its row for My card, About me, Privacy, Settings and the other pages.
 */
export async function open(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (screen === TALK) return toTalk(page, lang);
  await backToTabs(page, lang);
  if (TABS[screen]) {
    await tab(page, screen, lang).click();
  } else {
    await tab(page, "nav.me", lang).click();
    await navRow(page, screen, lang).click();
  }
  await onScreen(page, screen, lang);
}

/** Signs out from Settings' "This phone". */
export async function signOutHere(page: Page, lang: Lang = DEFAULT_LANG) {
  await open(page, "nav.settings", lang);
  await page.getByRole("button", { name: t(lang, "shell.sign_out"), exact: true }).click();
}

/** My card's form: Me, My card, then Edit my card. */
export async function openCard(page: Page, lang: Lang = DEFAULT_LANG) {
  await open(page, "nav.card", lang);
  await page.getByRole("button", { name: t(lang, "shell.edit_card"), exact: true }).click();
  await expect(page.getByRole("form", { name: t(lang, "a11y.my_card") })).toBeVisible();
}

/*
 * The drawer's old names, kept so specs written for it still compile: what they did with the drawer is done here now.
 * The drawer held the chats and New chat, so opening it opens the chats screen and the drawer is the signed-in frame
 * that screen and its dock stand in; the menu button is the Me tab; the frame is the top bar, on every signed-in screen.
 */

/** The signed-in frame: the top bar, the screen and its dock, and the tabs when they show. */
export const drawer = (page: Page, _lang: Lang = DEFAULT_LANG) => page.locator(".app.shell");

/** The Me tab, which holds what the drawer's rows did. */
export const menuButton = (page: Page, lang: Lang = DEFAULT_LANG) => tab(page, "nav.me", lang);

/** The signed-in frame, whatever the width or screen: its top bar. */
export const shell = (page: Page, _lang: Lang = DEFAULT_LANG) => page.getByRole("banner");

/** Opens the chats screen, where the drawer's chats and New chat are now. */
export const openDrawer = showChats;
