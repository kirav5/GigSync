import type { Ref } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { SIDEBAR_ID } from "./Sidebar.js";

interface Props {
  title: string;
  /** A screen opened from inside another: Back replaces the menu button. */
  sub: boolean;
  /** The chat is on screen: nothing to close. */
  home: boolean;
  /** The menu is open as a drawer. */
  open: boolean;
  /** Decisions waiting (the pill, and a dot on the menu button), and whether a mentor note is unread (a dot). */
  tasks: number;
  unread: boolean;
  /** Activity is on screen: the pill would only point at it. */
  onActivity: boolean;
  menuRef: Ref<HTMLButtonElement>;
  onMenu: () => void;
  onBack: () => void;
  onChat: () => void;
  onNeeds: () => void;
}

/**
 * Collab's title row: the menu button (Back on a screen opened from inside another), the open chat's or screen's
 * title, a small pill while decisions wait, and × back to the chat from any other screen.
 */
export function TopBar(props: Props) {
  const { title, sub, home, open, tasks, unread, onActivity, menuRef, onMenu, onBack, onChat, onNeeds } = props;
  const { t, plural } = useI18n();
  return (
    <header className="topbar">
      {sub ? (
        <button type={C.button} className="back" aria-label={t("a11y.back")} onClick={onBack}>
          <Icon name="back" />
        </button>
      ) : (
        <button
          ref={menuRef}
          type={C.button}
          className="menu"
          aria-label={t("shell.menu")}
          aria-controls={SIDEBAR_ID}
          aria-expanded={open}
          onClick={onMenu}
        >
          <Icon name="menu" size={22} />
          {(tasks > 0 || unread) && <span className="menu-dot" aria-hidden="true" />}
        </button>
      )}
      <span className="topbar-title">{title}</span>
      <span className="bar-end">
        {tasks > 0 && !onActivity && (
          <button type={C.button} className="need-pill" onClick={onNeeds}>
            {plural("shell.need_you", tasks)}
          </button>
        )}
        {!home && (
          <button type={C.button} className="close" aria-label={t("shell.to_chat")} onClick={onChat}>
            <Icon name="close" size={20} />
          </button>
        )}
      </span>
    </header>
  );
}
