import type { Ports } from "@gigsync/core";
import { type ReactNode, useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { useWideScreen } from "../adapters/wide.js";
import { useI18n } from "../i18n.js";
import { ProfileSheet } from "../screens/me/Profile.js";
import { useLinks } from "../screens/mentor/links.js";
import { Screen } from "../state.js";
import { BarProvider } from "../ui/Bar.js";
import { DockProvider } from "../ui/Dock.js";
import { ChatDrawer } from "./ChatDrawer.js";
import { chatOf, glows, isChat, isTab, sectionOf, titleOf } from "./nav.js";
import { ProfileButton } from "./ProfileButton.js";
import { TabBar } from "./TabBar.js";
import { TopBar } from "./TopBar.js";
import type { Nav } from "./useNav.js";
import "./shell.css";

/** The frame on a phone with the tab bar at its foot: a toast stands above the tabs. Home's glow is a class too. */
const SHELL = "app shell";
const TABBED = " tabbed";
const GLOW = " glow";

interface Props {
  ports: Ports;
  account: Account;
  nav: Nav;
  /** Decisions waiting for the owner, counted on the Jobs tab (and only there). */
  tasks: number;
  /** "New chat", from the wide rail. */
  onNewChat: () => void;
  children: ReactNode;
}

/**
 * What the dot on the profile button says: unread mentor notes, which the sheet's Help row counts too; empty for none.
 * The decisions waiting are the Jobs tab's count, not the profile's.
 */
function useProfileDot(): string {
  const { plural } = useI18n();
  const { unread } = useLinks();
  return unread > 0 ? plural("mentor.unread", unread) : "";
}

/**
 * The signed-in layout, top to bottom: the title row (the chats on its left, the profile on its right), the screen,
 * which alone scrolls, the dock with the screen's one primary action, and the three tabs on a tab's screen (and on the
 * landing one, so a worker without a card can reach them from Talk). On a wide screen the tabs stand beside it all as
 * a rail. The profile is a sheet over whatever is open; a row in it opens its screen above that one, and Back from
 * that screen comes to the sheet again. On a phone the
 * chats are a drawer from the left edge (the menu button, or a thumb pulling in from the edge); wide, a screen.
 */
export function Shell({ ports, account, nav, tasks, onNewChat, children }: Props) {
  const { t } = useI18n();
  const wide = useWideScreen();
  const dot = useProfileDot();
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const [chats, setChats] = useState(false);
  const { screen, stack, go, back, profile, setProfile } = nav;
  // A tab is a top place, as Home is: the tab bar moves between them, so a tab's bar has no Back.
  const atTab = isTab(account, screen);
  const tabbed = atTab || stack.length === 1;
  const title = titleOf(account, screen);
  // Home, the owner's chat, shows the brand.
  const shownTitle = title && t(title);
  // The warm glow sits at the foot of every screen with the tab bar, so the tabs look the same on each of them.
  const frame = SHELL + (tabbed && !wide ? TABBED : "") + (tabbed || glows(screen) ? GLOW : "");
  return (
    <BarProvider>
      <div className={frame}>
        <div className="main">
          <TopBar
            title={shownTitle}
            canBack={stack.length > 1 && !atTab}
            onBack={back}
            onChats={() => (wide ? go(Screen.chats) : setChats(true))}
            chatsAtEnd={isChat(screen)}
            alerts={{ dot: tasks > 0, onOpen: () => go(Screen.alerts) }}
            profile={<ProfileButton name={account.contact.name} dot={dot} onOpen={() => setProfile(true)} />}
          />
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
              wide={wide}
              chatOpen={isChat(screen)}
              onTab={go}
              onNewChat={onNewChat}
              onChatOpened={() => go(chatOf(account))}
            />
          )}
        </div>
        {!wide && (
          <ChatDrawer
            open={chats}
            onOpenChange={setChats}
            isWorker={account.role === AccountRole.worker}
            chatShown={isChat(screen)}
            onOpened={() => go(chatOf(account))}
            onNewChat={onNewChat}
          />
        )}
      </div>
      {profile && (
        <ProfileSheet ports={ports} account={account} onOpen={nav.goFromProfile} onClose={() => setProfile(false)} />
      )}
    </BarProvider>
  );
}
