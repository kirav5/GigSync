import type { MessageKey } from "@gigsync/core";
import { type ReactNode, useState } from "react";
import { useI18n } from "./i18n.js";
import { Screen } from "./state.js";
import { C } from "./ui/cls.js";
import { DockProvider } from "./ui/Dock.js";
import { Icon } from "./ui/Icon.js";
import { type TabItem, Tabs } from "./ui/Tabs.js";

/** Screens opened from inside a tab: their title, and where Back (on screen or Android's) returns to. */
export const SUB_SCREENS: Partial<Record<Screen, { title: MessageKey; parent: Screen }>> = {
  [Screen.card]: { title: "nav.card", parent: Screen.profile },
};

interface Props {
  tabs: readonly TabItem[];
  screen: Screen;
  onScreen: (s: Screen) => void;
  /** Decisions waiting for the owner, counted on Today or My jobs. */
  tasks: number;
  children: ReactNode;
}

/**
 * The signed-in layout, top to bottom: a title bar (with Back on a sub-screen), the screen, which alone scrolls, the
 * dock with the screen's one primary action, and the tab bar. The tab bar becomes a left rail on wide screens.
 */
export function Shell({ tabs, screen, onScreen, tasks, children }: Props) {
  const { t } = useI18n();
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const sub = SUB_SCREENS[screen];
  const current = sub ? sub.parent : screen;
  const tab = tabs.find((n) => n.screen === current);
  const title = sub ? t(sub.title) : tab ? t(tab.label) : "";
  return (
    <div className="app">
      <div className="main with-tabs">
        <header className="topbar">
          {sub && (
            <button type={C.button} className="back" aria-label={t("a11y.back")} onClick={() => onScreen(sub.parent)}>
              <Icon name="back" />
            </button>
          )}
          <span className="topbar-title">{title}</span>
        </header>
        {/* Keyed by screen so each one opens scrolled to its top, not where the last one was left. */}
        <main className="content" key={screen}>
          <div className="inner">
            <DockProvider slot={dock}>{children}</DockProvider>
          </div>
        </main>
        <div className="dock" ref={setDock} />
        <Tabs tabs={tabs} current={current} onScreen={onScreen} tasks={tasks} />
      </div>
    </div>
  );
}
