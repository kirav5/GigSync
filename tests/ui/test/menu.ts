import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The app's frame as the specs reach it: three tabs at the foot of a tab's screen (a rail beside the content on a wide
 * screen), the chats behind the top bar's round button on its left, Back there on every screen opened from inside
 * another, and the owner's pages in the profile sheet behind the round button with their initial on the right. Specs
 * name screens by their old menu keys; each finds its way from here.
 */

/** The three tabs, named in the owner's language: at the foot of a tab's screen, or the rail on a wide screen. */
export const tabBar = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("navigation", { name: t(lang, "shell.tabs") });

/**
 * The tabs each old menu key is reached by now. Records is the ₹ tab, Earnings for a worker and Payments for a
 * household; Home is the chat, Talk or Find.
 */
const TABS: Partial<Record<MessageKey, readonly MessageKey[]>> = {
  "nav.activity": ["nav.jobs"],
  "nav.my_jobs": ["nav.jobs"],
  "nav.jobs": ["nav.jobs"],
  "nav.records": ["nav.earnings", "nav.payments"],
  "nav.earnings": ["nav.earnings"],
  "nav.payments": ["nav.payments"],
  "nav.find": ["nav.home"],
  "nav.home": ["nav.home"],
};
/** Talk, a worker's chat: their Home. */
const TALK: MessageKey = "nav.talk";
/** The old Me tab: the profile sheet now. */
const ME: MessageKey = "profile.title";

/** One tab by its name (an old menu key finds its new tab), counted or not: the name is exact. */
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

/** The round button with the owner's initial, at the top bar's end, which opens the profile sheet. */
export const profileButton = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("banner").getByRole("button", { name: t(lang, "profile.open"), exact: true });

/** The profile sheet, while it is open. */
export const profileSheet = (page: Page, lang: Lang = DEFAULT_LANG) => page.getByRole("dialog", { name: t(lang, ME) });

/** Opens the profile sheet from any screen. */
export async function openProfile(page: Page, lang: Lang = DEFAULT_LANG) {
  if (await profileSheet(page, lang).isVisible()) return;
  await profileButton(page, lang).click();
  await expect(profileSheet(page, lang)).toBeVisible();
}

/** Back out of screens opened from inside others until the tabs show (a phone shows them on a tab's screen only). */
export async function backToTabs(page: Page, lang: Lang = DEFAULT_LANG) {
  // The frame first: right after a reload the app has not drawn yet.
  await expect(page.getByRole("banner")).toBeVisible();
  // An open profile sheet makes the page behind it inert: Done closes it.
  if (await profileSheet(page, lang).isVisible()) {
    await profileSheet(page, lang)
      .getByRole("button", { name: t(lang, "profile.done"), exact: true })
      .click();
    await expect(profileSheet(page, lang)).toBeHidden();
  }
  // An open chats drawer shades the screen behind it, as a phone's drawer does: Escape closes it.
  const chats = page.getByRole("navigation", { name: t(lang, "chats.title"), exact: true });
  if (await chats.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(chats).toBeHidden();
  }
  while (!(await tabBar(page, lang).isVisible()) && (await back(page, lang).isVisible()))
    await back(page, lang).click();
  await expect(tabBar(page, lang)).toBeVisible();
}

/** Find's chat on a household's Home: its composer, or New need once its workers were asked. */
const findChat = (page: Page, lang: Lang) =>
  page
    .getByRole("form", { name: t(lang, "need.composer") })
    .or(page.getByRole("button", { name: t(lang, "chats.new_need"), exact: true }));

/** Talk, a worker's Home: already on it, or the Home tab. */
async function toTalk(page: Page, lang: Lang) {
  await expect(page.getByRole("banner")).toBeVisible();
  if (await talkForm(page, lang).isVisible()) return;
  await backToTabs(page, lang);
  if (await talkForm(page, lang).isVisible()) return;
  await tab(page, "nav.home", lang).click();
  await expect(talkForm(page, lang)).toBeVisible();
}

/** Back to the owner's chat from any screen: their Home, Talk for a worker and Find for a household. */
export async function toChat(page: Page, lang: Lang = DEFAULT_LANG) {
  await expect(page.getByRole("banner")).toBeVisible();
  if (await talkForm(page, lang).isVisible()) return;
  await backToTabs(page, lang);
  if (await talkForm(page, lang).isVisible()) return;
  await tab(page, "nav.home", lang).click();
  await expect(talkForm(page, lang).or(findChat(page, lang)).first()).toBeVisible();
}

/** The chats kept on this phone, on their own screen. */
export const chatList = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("region", { name: t(lang, "chats.title") });

/** Opens the chats from the owner's chat: the top bar's round chats button on Talk or Find. */
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

/** The names a page goes by for one side or the other: a household's My card is My QR, as it holds only the QR. */
const NAMES: Partial<Record<MessageKey, readonly MessageKey[]>> = { "nav.card": ["nav.card", "profile.my_qr"] };

/** Text as a regular expression matches it, literally. (helpers.ts has the same; it imports this file.) */
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A screen's name, whichever side the owner is on: exact, as a row's or the top bar's. */
const nameOf = (screen: MessageKey, lang: Lang): RegExp =>
  new RegExp(`^(${(NAMES[screen] ?? [screen]).map((k) => literal(t(lang, k))).join("|")})$`);

/**
 * A screen the old menu opened, by its key: a tab's button, or, for the owner's pages, the profile sheet's row with
 * that exact name (a count or the line under a row is its description, never its name).
 */
export const navRow = (page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) =>
  TABS[screen] ? tab(page, screen, lang) : profileSheet(page, lang).getByRole("button", { name: nameOf(screen, lang) });

/** Expects `screen` to be the one showing: its tab marked, Talk's composer, the sheet, or its name in the top bar. */
export async function onScreen(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (screen === TALK) {
    await expect(talkForm(page, lang)).toBeVisible();
    return;
  }
  if (screen === ME) {
    await expect(profileSheet(page, lang)).toBeVisible();
    return;
  }
  if (TABS[screen]) {
    await expect(tab(page, screen, lang)).toHaveAttribute("aria-current", "page");
    return;
  }
  await expect(title(page)).toHaveText(nameOf(screen, lang));
}

/** Alerts open from the bell in the top bar, not from the profile. */
const ALERTS = "tabs.alerts";

/**
 * Opens a screen by its old menu key: the tab for Jobs (Activity, My jobs), Earnings or Payments (Records) and Home (Find, Talk);
 * the profile sheet for `profile.title`, and its row for My card, About me, Privacy, Settings and the other pages,
 * which open above the tab the owner was on.
 */
export async function open(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  if (screen === TALK) return toTalk(page, lang);
  await backToTabs(page, lang);
  if (TABS[screen]) {
    await tab(page, screen, lang).click();
  } else if (screen === ALERTS) {
    await page
      .getByRole("banner")
      .getByRole("button", { name: t(lang, ALERTS), exact: true })
      .click();
  } else {
    await openProfile(page, lang);
    if (screen !== ME) await navRow(page, screen, lang).click();
  }
  await onScreen(page, screen, lang);
}

/** Signs out from Settings' "This phone". */
export async function signOutHere(page: Page, lang: Lang = DEFAULT_LANG) {
  await open(page, "nav.settings", lang);
  await page.getByRole("button", { name: t(lang, "shell.sign_out"), exact: true }).click();
}

/** My card's form: the profile, My card, then Edit my card. */
export async function openCard(page: Page, lang: Lang = DEFAULT_LANG) {
  await open(page, "nav.card", lang);
  await page.getByRole("button", { name: t(lang, "shell.edit_card"), exact: true }).click();
  await expect(page.getByRole("form", { name: t(lang, "a11y.my_card") })).toBeVisible();
}

/*
 * The drawer's old names, kept so specs written for it still compile: what they did with the drawer is done here now.
 * The drawer held the chats and New chat, so opening it opens the chats screen and the drawer is the signed-in frame
 * that screen and its dock stand in; the menu button is the profile button; the frame is the top bar.
 */

/** The signed-in frame: the top bar, the screen and its dock, and the tabs when they show. */
export const drawer = (page: Page, _lang: Lang = DEFAULT_LANG) => page.locator(".app.shell");

/** The profile button, which holds what the drawer's rows did. */
export const menuButton = profileButton;

/** The signed-in frame, whatever the width or screen: its top bar. */
export const shell = (page: Page, _lang: Lang = DEFAULT_LANG) => page.getByRole("banner");

/** Opens the chats screen, where the drawer's chats and New chat are now. */
export const openDrawer = showChats;
