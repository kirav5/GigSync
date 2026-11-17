import type { MessageKey } from "@gigsync/core";
import { type Account, AccountRole } from "../adapters/account.js";
import { Screen } from "../state.js";
import type { IconName } from "../ui/Icon.js";

/** One bottom tab: the screen it opens, its name, and its line icon. */
export interface Tab {
  screen: Screen;
  label: MessageKey;
  icon: IconName;
}

/**
 * A worker's three tabs, in the design's order: Home is their chat with their agent (Talk), then their jobs and what
 * they earned (Earnings), as a household's. Everything about themselves is in the profile sheet, from the round button with their
 * initial at the top right (ProfileSheet.tsx).
 */
const WORKER_TABS: readonly Tab[] = [
  { screen: Screen.talk, label: "nav.home", icon: "home" },
  { screen: Screen.activity, label: "nav.jobs", icon: "jobs" },
  { screen: Screen.records, label: "nav.earnings", icon: "rupee" },
];

/** A household's three: Home is asking for help (Find's chat), then the jobs it led to and what they paid (Payments). */
const HOUSEHOLD_TABS: readonly Tab[] = [
  { screen: Screen.find, label: "nav.home", icon: "home" },
  { screen: Screen.activity, label: "nav.jobs", icon: "jobs" },
  { screen: Screen.records, label: "nav.payments", icon: "rupee" },
];

/** The tab that carries the count of decisions waiting. */
export const COUNTED_TAB: Screen = Screen.activity;

/** The screens that hold a chat: the top bar names the open one there, and the wide rail lists the others. */
const CHAT_SCREENS: ReadonlySet<Screen> = new Set([Screen.talk, Screen.find]);

/** Each owner's Home, their chat: the top bar shows the brand there instead of a title, over the warm glow. */
const HOME_SCREENS: ReadonlySet<Screen> = CHAT_SCREENS;

/** The top bar's title for each screen that is neither a tab nor a chat. */
const TITLES: Partial<Record<Screen, MessageKey>> = {
  [Screen.cardEdit]: "nav.card",
  [Screen.about]: "nav.about",
  [Screen.privacy]: "nav.privacy",
  [Screen.settings]: "nav.settings",
  [Screen.link]: "mentor.links",
  [Screen.landing]: "landing.title",
  [Screen.findMentor]: "mentor.find",
  [Screen.person]: "qr.person",
  [Screen.install]: "install.screen",
  [Screen.moveOut]: "phone.move_out",
  [Screen.moveIn]: "phone.in_title",
  [Screen.terms]: "records.terms_title",
  [Screen.chats]: "chats.title",
  [Screen.alerts]: "tabs.alerts",
  [Screen.help]: "me.help",
  [Screen.people]: "me.people",
  [Screen.language]: "me.language",
  [Screen.addresses]: "me.addresses",
  [Screen.workArea]: "me.work_area",
  [Screen.myRecord]: "me.record",
  [Screen.verify]: "idcheck.title",
};

const isWorker = (account: Account): boolean => account.role === AccountRole.worker;

/** The owner's three tabs. */
export const tabsOf = (account: Account): readonly Tab[] => (isWorker(account) ? WORKER_TABS : HOUSEHOLD_TABS);

/** Where the owner lands, and where Back ends: their Home, the chat (Talk for a worker, Find for a household). */
export const landingOf = (account: Account): Screen => chatOf(account);

/** Whether the screen is one of the owner's tabs. */
export const isTab = (account: Account, screen: Screen): boolean => tabsOf(account).some((t) => t.screen === screen);

/** Whether the screen holds the owner's chat: Talk for a worker, Find for a household. */
export const isChat = (screen: Screen): boolean => CHAT_SCREENS.has(screen);

/** Whether the screen is the owner's Home, with the brand in the top bar's middle. */
export const isHome = (screen: Screen): boolean => HOME_SCREENS.has(screen);

/** Whether the screen has the warm glow at its foot: Home. */
export const glows = isHome;

/** Each owner's chat, their Home: Talk for a worker, Find's chat for a household. */
export function chatOf(account: Account): Screen {
  return isWorker(account) ? Screen.talk : Screen.find;
}

/** What My card is called: a household has no card, only the QR a worker scans, so theirs is My QR. */
export const cardTitleOf = (account: Account): MessageKey => (isWorker(account) ? "nav.card" : "profile.my_qr");

/** The top bar's title for a screen: its own, or its tab's name. None for Home (the brand) and Talk (its chat's). */
export function titleOf(account: Account, screen: Screen): MessageKey | undefined {
  if (isHome(screen)) return undefined;
  if (screen === Screen.card) return cardTitleOf(account);
  return TITLES[screen] ?? tabsOf(account).find((t) => t.screen === screen)?.label;
}

/** The tab a stack of screens sits under, to mark in the tab bar: the nearest tab below the top, or Home. */
export function sectionOf(account: Account, stack: readonly Screen[]): Screen {
  return [...stack].reverse().find((s) => isTab(account, s)) ?? chatOf(account);
}
