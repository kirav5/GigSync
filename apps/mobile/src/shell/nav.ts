import type { MessageKey } from "@gigsync/core";
import { type Account, AccountRole } from "../adapters/account.js";
import { Screen } from "../state.js";
import type { IconName } from "../ui/Icon.js";

/** One row of the menu: the screen it opens, its name, and its line icon. */
export interface NavRow {
  screen: Screen;
  label: MessageKey;
  icon: IconName;
}

/**
 * The menu's rows, in the collab app's order, the same for a worker and a household: what each opens differs by role
 * (Records holds a worker's earnings and work record, or what a household paid).
 */
export const NAV_ROWS: readonly NavRow[] = [
  { screen: Screen.activity, label: "nav.activity", icon: "activity" },
  { screen: Screen.records, label: "nav.records", icon: "receipt" },
  { screen: Screen.card, label: "nav.card", icon: "card" },
  { screen: Screen.about, label: "nav.about", icon: "user" },
  { screen: Screen.privacy, label: "nav.privacy", icon: "shield" },
  { screen: Screen.settings, label: "nav.settings", icon: "settings" },
];

/** The row that carries the count of decisions waiting, and the one with a dot while a mentor note is unread. */
export const COUNTED_ROW: Screen = Screen.activity;
export const DOTTED_ROW: Screen = Screen.privacy;

/** Screens opened from inside another: their title, and where Back goes (home when no parent is named). */
const SUB_SCREENS: Partial<Record<Screen, { title: MessageKey; parent?: Screen }>> = {
  [Screen.cardEdit]: { title: "nav.card", parent: Screen.card },
  [Screen.link]: { title: "mentor.links", parent: Screen.privacy },
  [Screen.landing]: { title: "landing.title", parent: Screen.talk },
  [Screen.findMentor]: { title: "mentor.find", parent: Screen.talk },
  [Screen.person]: { title: "qr.person" },
  [Screen.install]: { title: "install.screen" },
  [Screen.moveOut]: { title: "phone.move_out", parent: Screen.settings },
  [Screen.moveIn]: { title: "phone.in_title", parent: Screen.settings },
  [Screen.terms]: { title: "records.terms_title", parent: Screen.settings },
};

/** The chat each owner lands on, and where Back ends: Find's chat for a household, Talk for a worker. */
export const homeOf = (account: Account): Screen => (account.role === AccountRole.consumer ? Screen.find : Screen.talk);

/** Whether the screen is the owner's chat. */
export const isHome = (screen: Screen): boolean => screen === Screen.find || screen === Screen.talk;

/** A screen opened from inside another, with Back on its title row instead of the menu. */
export const isSub = (screen: Screen): boolean => SUB_SCREENS[screen] !== undefined;

/** The top bar's title for a screen other than the chat (the chat's title is its own). */
export function titleOf(screen: Screen): MessageKey | undefined {
  return SUB_SCREENS[screen]?.title ?? NAV_ROWS.find((row) => row.screen === screen)?.label;
}

/** Where Back goes from `screen`: a sub-screen to the one it was opened from, any other to home; none from home. */
export function backFrom(screen: Screen, home: Screen): Screen | undefined {
  if (screen === home) return undefined;
  return SUB_SCREENS[screen]?.parent ?? home;
}
