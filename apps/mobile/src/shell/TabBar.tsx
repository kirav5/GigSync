import { useId } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import type { Screen } from "../state.js";
import { Brand } from "../ui/Brand.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { useChatList } from "./chatLists.js";
import { DrawerChats } from "./DrawerChats.js";
import { COUNTED_TAB, type Tab, tabsOf } from "./nav.js";

/** A tab on its own screen, and one whose screen lies under the open one. */
const TAB = "tab";
const TAB_ON = "tab on";

interface TabProps {
  tab: Tab;
  /** The tab's own screen is open. */
  current: boolean;
  /** The open screen lies under this tab. */
  on: boolean;
  /** A count after the label; empty for none. */
  count: string;
  onOpen: () => void;
}

/** One tab: its icon over its name, with a count, rust while the owner is under it. */
function TabButton({ tab, current, on, count, onOpen }: TabProps) {
  const { t } = useI18n();
  const id = useId();
  const about = count ? id : undefined;
  // Named by its label alone, so tests and screen readers find it by name; the count is its description.
  return (
    <button
      type={C.button}
      className={on ? TAB_ON : TAB}
      aria-current={current ? "page" : undefined}
      aria-label={t(tab.label)}
      aria-describedby={about}
      onClick={onOpen}
    >
      <span className="tab-icon">
        <Icon name={tab.icon} size={22} />
        {count && (
          <span id={about} className="tab-count">
            {count}
          </span>
        )}
      </span>
      <span className="tab-label">{t(tab.label)}</span>
    </button>
  );
}

/** The wide rail's chats while one is open: New chat, then the chats kept on this phone. */
function RailChats({
  account,
  onNewChat,
  onOpened,
}: {
  account: Account;
  onNewChat: () => void;
  onOpened: () => void;
}) {
  const { t } = useI18n();
  const list = useChatList(account.role === AccountRole.worker);
  return (
    <div className="rail-chats">
      <button type={C.button} className={C.secondary} onClick={onNewChat}>
        <Icon name="plus" size={16} />
        {t("chats.new")}
      </button>
      <DrawerChats list={list} shown onOpened={onOpened} />
    </div>
  );
}

interface TabBarProps {
  account: Account;
  /** The open screen, and the tab it lies under. */
  screen: Screen;
  section: Screen;
  /** Decisions waiting for the owner, a count on Jobs. */
  tasks: number;
  /** A wide screen: the tabs stand as a rail beside the content, with the brand, and the chats while one is open. */
  wide: boolean;
  /** A chat is open (Talk or Find): the rail lists the others. */
  chatOpen: boolean;
  onTab: (s: Screen) => void;
  onNewChat: () => void;
  onChatOpened: () => void;
}

/**
 * The three tabs, at the bottom of a tab's screen on a phone: Home, Jobs and Money for both, a household's Home being
 * Find. Plain buttons in a navigation landmark, not ARIA tabs: Jobs has tabs of its own. On a wide screen the same
 * tabs stand in a rail beside the content.
 */
export function TabBar(props: TabBarProps) {
  const { account, screen, section, tasks, wide, chatOpen, onTab, onNewChat, onChatOpened } = props;
  const { t } = useI18n();
  return (
    <nav className="tabbar" aria-label={t("shell.tabs")}>
      {wide && (
        <div className="rail-head">
          <Brand />
        </div>
      )}
      <div className="tabs">
        {tabsOf(account).map((tab) => (
          <TabButton
            key={tab.screen}
            tab={tab}
            current={tab.screen === screen}
            on={tab.screen === section}
            count={tab.screen === COUNTED_TAB && tasks > 0 ? String(tasks) : ""}
            onOpen={() => onTab(tab.screen)}
          />
        ))}
      </div>
      {wide && chatOpen && <RailChats account={account} onNewChat={onNewChat} onOpened={onChatOpened} />}
    </nav>
  );
}
