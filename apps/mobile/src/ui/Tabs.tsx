import type { MessageKey } from "@gigsync/core";
import { useId } from "react";
import { useI18n } from "../i18n.js";
import { Screen } from "../state.js";
import { C } from "./cls.js";
import { Icon, type IconName } from "./Icon.js";

export interface TabItem {
  screen: Screen;
  label: MessageKey;
  icon: IconName;
}

const PROFILE: TabItem = { screen: Screen.profile, label: "nav.profile", icon: "user" };

/** A worker's four tabs: today's jobs and decisions, talking to their agent, the money, and everything else. */
export const WORKER_TABS: readonly TabItem[] = [
  { screen: Screen.today, label: "nav.today", icon: "home" },
  { screen: Screen.talk, label: "nav.talk", icon: "mic" },
  { screen: Screen.passbook, label: "nav.passbook", icon: "book" },
  PROFILE,
];

/** A consumer's three tabs: find someone, follow what was asked, everything else. */
export const CONSUMER_TABS: readonly TabItem[] = [
  { screen: Screen.find, label: "nav.find", icon: "search" },
  { screen: Screen.requests, label: "nav.my_jobs", icon: "jobs" },
  PROFILE,
];

/** The tabs that carry the count of decisions waiting for the owner. */
const BADGED: ReadonlySet<Screen> = new Set([Screen.today, Screen.requests]);

interface Props {
  tabs: readonly TabItem[];
  /** The tab to mark as the current page. */
  current: Screen;
  onScreen: (s: Screen) => void;
  /** Decisions waiting for the owner. */
  tasks: number;
}

/**
 * Icon-and-label tabs along the bottom, as in WhatsApp, PhonePe and GPay: every destination in sight, none behind a
 * menu. A left rail on wide screens, and hidden while the keyboard is open so the dock sits on the keys (styles.css).
 */
export function Tabs({ tabs, current, onScreen, tasks }: Props) {
  const { t } = useI18n();
  const id = useId();
  return (
    <nav className="tabs" aria-label={t("a11y.tabs")}>
      {tabs.map((tab) => {
        const badge = BADGED.has(tab.screen) && tasks > 0 ? `${id}-${tab.screen}` : undefined;
        // The tab is named by its label alone, so it stays findable by name; the count is its description.
        return (
          <button
            key={tab.screen}
            type={C.button}
            aria-label={t(tab.label)}
            aria-describedby={badge}
            aria-current={tab.screen === current ? "page" : undefined}
            onClick={() => onScreen(tab.screen)}
          >
            <Icon name={tab.icon} />
            <span className="tab-label">{t(tab.label)}</span>
            {badge && (
              <span id={badge} className="badge" role="img" aria-label={t("trail.to_decide", { count: tasks })}>
                {tasks}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
