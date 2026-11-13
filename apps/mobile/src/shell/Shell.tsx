import { type ReactNode, useState } from "react";
import type { Account } from "../adapters/account.js";
import { useWideScreen } from "../adapters/wide.js";
import { useI18n } from "../i18n.js";
import { useLinks } from "../screens/mentor/links.js";
import { Screen } from "../state.js";
import { BarProvider } from "../ui/Bar.js";
import { DockProvider } from "../ui/Dock.js";
import { chatOf, isChat, isTab, sectionOf, titleOf } from "./nav.js";
import { TabBar } from "./TabBar.js";
import { TopBar } from "./TopBar.js";
import type { Nav } from "./useNav.js";
import "./shell.css";

/** The frame on a phone with the tab bar at its foot: a toast stands above the tabs. */
const TABBED = "app shell tabbed";
const PLAIN = "app shell";

interface Props {
  account: Account;
  nav: Nav;
  /** Decisions waiting for the owner, counted on the Jobs tab. */
  tasks: number;
  /** The open chat's title, shown in the top bar on Talk. */
  chatTitle: string;
  /** "New chat", from the wide rail. */
  onNewChat: () => void;
  children: ReactNode;
}

/**
 * The signed-in layout, top to bottom: the title row, the screen, which alone scrolls, the dock with the screen's one
 * primary action, and the four tabs on a tab's screen (and on the landing one, so a worker without a card can reach
 * them from Talk). On a wide screen the tabs stand beside it all as a rail.
 */
export function Shell({ account, nav, tasks, chatTitle, onNewChat, children }: Props) {
  const { t } = useI18n();
  const { unread } = useLinks();
  const wide = useWideScreen();
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const { screen, stack, go, back } = nav;
  const tabbed = isTab(account, screen) || stack.length === 1;
  const title = titleOf(account, screen);
  return (
    <BarProvider>
      <div className={tabbed && !wide ? TABBED : PLAIN}>
        <div className="main">
          <TopBar title={title ? t(title.key, title.params) : chatTitle} canBack={stack.length > 1} onBack={back} />
          {/* Keyed by screen so each one opens scrolled to its top, not where the last one was left. */}
          <main className="content" key={screen}>
            <div className="inner">
              <DockProvider slot={dock}>{children}</DockProvider>
            </div>
          </main>
          <div className="dock" ref={setDock} />
          {(tabbed || wide) && (
            <TabBar
              account={account}
              screen={screen}
              section={sectionOf(account, stack)}
              tasks={tasks}
              unread={unread}
              wide={wide}
              chatOpen={isChat(screen)}
              onTab={go}
              onNewChat={onNewChat}
              onChatOpened={() => go(chatOf(account))}
            />
          )}
        </div>
      </div>
    </BarProvider>
  );
}
