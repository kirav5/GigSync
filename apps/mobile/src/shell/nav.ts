import type { MessageKey, Params } from "@gigsync/core";
import { type Account, AccountRole } from "../adapters/account.js";
import { Screen } from "../state.js";
import type { IconName } from "../ui/Icon.js";

/** One bottom tab: the screen it opens, its name, and its line icon. */
export interface Tab {
  screen: Screen;
  label: MessageKey;
  icon: IconName;
}

/** A worker's four tabs, in the design's order: what needs them today, their jobs, their money, and themselves. */
const WORKER_TABS: readonly Tab[] = [
  { screen: Screen.home, label: "nav.home", icon: "home" },
  { screen: Screen.activity, label: "nav.jobs", icon: "jobs" },
  { screen: Screen.records, label: "nav.money", icon: "rupee" },
  { screen: Screen.me, label: "nav.me", icon: "user" },
];

/** A household's four: asking for help first, then the jobs it led to, what they paid, and themselves. */
const HOUSEHOLD_TABS: readonly Tab[] = [
  { screen: Screen.find, label: "nav.find", icon: "search" },
  { screen: Screen.activity, label: "nav.jobs", icon: "jobs" },
  { screen: Screen.records, label: "nav.pay", icon: "rupee" },
  { screen: Screen.me, label: "nav.me", icon: "user" },
];

/** The tab that carries the count of decisions waiting, and the one with a dot while a mentor note is unread. */
export const COUNTED_TAB: Screen = Screen.activity;
export const DOTTED_TAB: Screen = Screen.me;

/** The screens that hold a chat: the top bar names the open one there, and the wide rail lists the others. */
const CHAT_SCREENS: ReadonlySet<Screen> = new Set([Screen.talk, Screen.find]);

/** The top bar's title for each screen that is neither a tab nor a chat. */
const TITLES: Partial<Record<Screen, MessageKey>> = {
  [Screen.card]: "nav.card",
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
  [Screen.myRecord]: "me.record",
};

const isWorker = (account: Account): boolean => account.role === AccountRole.worker;

/** The owner's four tabs. */
export const tabsOf = (account: Account): readonly Tab[] => (isWorker(account) ? WORKER_TABS : HOUSEHOLD_TABS);

/**
 * Where the owner lands, and where Back ends: Find for a household; Home for a worker with a card, and Talk for one
 * without, where the card interview starts.
 */
export function landingOf(account: Account): Screen {
  if (!isWorker(account)) return Screen.find;
  return account.worker ? Screen.home : Screen.talk;
}

/** Whether the screen is one of the owner's tabs. */
export const isTab = (account: Account, screen: Screen): boolean => tabsOf(account).some((t) => t.screen === screen);

/** Whether the screen holds the owner's chat: Talk for a worker, Find for a household. */
export const isChat = (screen: Screen): boolean => CHAT_SCREENS.has(screen);

/** Each owner's chat: Talk for a worker, Find's chat for a household. */
export const chatOf = (account: Account): Screen => (isWorker(account) ? Screen.talk : Screen.find);

/** A title as the top bar says it: a key, and the owner's name where the key greets them. */
interface Title {
  key: MessageKey;
  params?: Params;
}

/**
 * The top bar's title for a screen: its own, or its tab's name. Home greets the worker by name; Find says what it is
 * for. Undefined for Talk, whose title is the open chat's.
 */
export function titleOf(account: Account, screen: Screen): Title | undefined {
  if (screen === Screen.home) return { key: "tabs.namaste", params: { name: account.contact.name } };
  if (screen === Screen.find) return { key: "tabs.find_title" };
  const key = TITLES[screen] ?? tabsOf(account).find((t) => t.screen === screen)?.label;
  return key ? { key } : undefined;
}

/**
 * The tab a stack of screens sits under, to mark in the tab bar: the nearest tab below the top, or Home when the stack
 * holds none (a worker without a card, on the Talk they landed on, which Home opens).
 */
export function sectionOf(account: Account, stack: readonly Screen[]): Screen {
  return [...stack].reverse().find((s) => isTab(account, s)) ?? Screen.home;
}
