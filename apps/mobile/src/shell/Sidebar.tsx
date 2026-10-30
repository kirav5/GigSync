import type { MessageKey } from "@gigsync/core";
import { useId } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { ModelChoice, useChosenModel } from "../adapters/model.js";
import { useI18n } from "../i18n.js";
import { Screen } from "../state.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { Logo } from "../ui/Logo.js";
import { DrawerChats } from "./DrawerChats.js";
import { COUNTED_ROW, DOTTED_ROW, isHome, NAV_ROWS, type NavRow } from "./nav.js";
import { SideFoot } from "./SideFoot.js";

/** The menu's id, which the top bar's menu button controls. */
export const SIDEBAR_ID = "sidebar";
/** The brand beside the logo, a name and not a word to translate. */
const BRAND = "GigSync";

/** The chip's words for each engine that can answer. */
const ENGINE_CHIP: Readonly<Record<ModelChoice, MessageKey>> = {
  [ModelChoice.auto]: "shell.model_device",
  [ModelChoice.device]: "shell.model_device",
  [ModelChoice.lite]: "shell.model_lite",
  [ModelChoice.ollama]: "shell.model_ollama",
};

export interface SidebarProps {
  account: Account;
  screen: Screen;
  onScreen: (s: Screen) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  /** Decisions waiting for the owner, and mentor notes not read yet. */
  tasks: number;
  unread: number;
  /** Shown as a drawer (phones): its × closes it. */
  drawer: boolean;
  onClose: () => void;
}

/** What runs the agent, as collab's "Powered by" chip: the phone's own model, Ollama in development, or lite mode. */
function EngineChip({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const model = useChosenModel();
  const engine = model.answering();
  const cls = engine === ModelChoice.lite ? "engine-chip" : "engine-chip peri";
  return (
    <button type={C.button} className={cls} title={t("shell.model_about")} onClick={onOpen}>
      ✦ {t(ENGINE_CHIP[engine], { name: model.current.ollamaModel })}
    </button>
  );
}

/** One row of the menu: its icon and name, a count or a dot after it, marked while its screen is open. */
function Row({
  row,
  on,
  trail,
  dot,
  onOpen,
}: {
  row: NavRow;
  on: boolean;
  trail: string;
  dot: string;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const about = trail || dot ? id : undefined;
  // Named by its label alone, so it stays findable by name; the count or the dot is its description.
  return (
    <button
      type={C.button}
      className={on ? "on" : undefined}
      aria-current={on ? "page" : undefined}
      aria-label={t(row.label)}
      aria-describedby={about}
      onClick={onOpen}
    >
      <span className="ico">
        <Icon name={row.icon} />
      </span>
      {t(row.label)}
      {trail && (
        <span id={about} className="trail">
          {trail}
        </span>
      )}
      {dot && <span id={about} className="trail-dot" role="img" aria-label={dot} />}
    </button>
  );
}

/**
 * The menu, as the collab app's sidebar: the logo and what runs the agent, "N need you »" while decisions wait, New
 * chat, the screens, the chats kept on this phone, and who is signed in with Sign out and Install app. A drawer over
 * the screen on a phone; beside the content on a wide screen.
 */
export function Sidebar(props: SidebarProps) {
  const { account, screen, onScreen, onNewChat, onSignOut, tasks, unread, drawer, onClose } = props;
  const { t, plural } = useI18n();
  const isWorker = account.role === AccountRole.worker;
  const needYou = plural("shell.need_you", tasks);
  return (
    <nav id={SIDEBAR_ID} className="sidebar" aria-label={t("shell.drawer")}>
      <header>
        <span className="brand">
          <Logo size={16} />
          <span className="label ink">{BRAND}</span>
        </span>
        <span className="bar-end">
          <EngineChip onOpen={() => onScreen(Screen.settings)} />
          {drawer && (
            <button type={C.button} className="side-close" aria-label={t("shell.close_menu")} onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          )}
        </span>
      </header>
      <div className="scroll">
        {tasks > 0 && (
          <button type={C.button} className="side-btn accent needs" onClick={() => onScreen(COUNTED_ROW)}>
            <span className="dot" aria-hidden="true" /> {needYou} »
          </button>
        )}
        <button type={C.button} className="side-btn new-chat" onClick={onNewChat}>
          <Icon name="plus" size={16} />
          {t("chats.new")}
        </button>
        <div className="nav">
          {NAV_ROWS.map((row) => (
            <Row
              key={row.screen}
              row={row}
              on={row.screen === screen}
              trail={row.screen === COUNTED_ROW && tasks > 0 ? String(tasks) : ""}
              dot={row.screen === DOTTED_ROW && unread > 0 ? plural("mentor.unread", unread) : ""}
              onOpen={() => onScreen(row.screen)}
            />
          ))}
        </div>
        {isWorker ? (
          <DrawerChats shown={isHome(screen)} onOpened={() => onScreen(Screen.talk)} />
        ) : (
          <p className={C.faint}>{t("shell.find_fresh")}</p>
        )}
      </div>
      <SideFoot account={account} onAbout={() => onScreen(Screen.about)} onSignOut={onSignOut} />
    </nav>
  );
}
